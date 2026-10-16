import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { numero, mensagem } from './config.js';

const TEMPO_CONEXAO_MS = 120_000;
const TEMPO_QR_MS = 180_000;
const TEMPO_OPERACAO_MS = 30_000;
const MAX_REINICIOS = 3;

const ERROS_TRANSITORIOS = new Set([
  DisconnectReason.restartRequired,
  DisconnectReason.connectionClosed,
  DisconnectReason.connectionLost,
  DisconnectReason.timedOut,
]);

const mascarar = valor => `****${String(valor).split('@')[0].slice(-4)}`;

function comTimeout(promessa, ms, textoErro) {
  let temporizador;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(() => reject(new Error(textoErro)), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
}

export function validar(numero, texto) {
  if (typeof numero !== 'string' || !/^\+?[\d\s().-]+$/.test(numero.trim())) {
    throw new Error('Informe um numero real em config.js com DDI e DDD.');
  }
  const normalizado = numero.replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(normalizado)) {
    throw new Error('Telefone invalido: use DDI + DDD + numero.');
  }
  if (typeof texto !== 'string' || !texto.trim() || texto.length > 4096) {
    throw new Error('A mensagem precisa ter de 1 a 4096 caracteres.');
  }
  return normalizado;
}

export async function enviar(socket, jid, texto, numeroParaLog = jid) {
  const alvo = mascarar(numeroParaLog);
  let aceitas = 0;
  let incertas = 0;

  try {
    const resultado = await socket.sendMessage(jid, { text: texto });
    if (!resultado?.key?.id) throw new Error('Envio sem confirmacao de ID.');
    aceitas++;
    console.log(`Aceita para ${alvo}.`);
  } catch (erro) {
    incertas++;
    console.error(`Envio para ${alvo} nao confirmado: ${erro.message}`);
    console.error('O script nao repetira o envio automaticamente.');
  }

  console.log(`\nChamadas: 1 | Aceitas: ${aceitas} | Nao confirmadas: ${incertas}`);
  return { chamadas: 1, aceitas, incertas };
}

// libsignal imprime registros de sessao (com material de chave) via console.
function silenciarLogsDeSessao() {
  const info = console.info;
  const warn = console.warn;
  console.info = (...args) => {
    if (args[0] === 'Closing session:' || args[0] === 'Opening session:') return;
    info(...args);
  };
  console.warn = (...args) => {
    if (args[0] === 'Session already closed') return;
    warn(...args);
  };
  return () => { console.info = info; console.warn = warn; };
}

async function main() {
  const destinatario = validar(numero, mensagem);

  if (process.argv.includes('--simular')) {
    console.log('SIMULACAO - nenhuma conexao ou envio realizado.');
    console.log('Mensagem:', mensagem);
    console.log('Destinatario:', mascarar(destinatario));
    console.log('Chamadas: 0 | Planejadas: 1');
    return;
  }

  // oxlint-disable-next-line react-hooks/rules-of-hooks -- API do Baileys, não é um React Hook.
  const { state, saveCreds } = await useMultiFileAuthState(
    fileURLToPath(new URL('./auth/', import.meta.url)),
  );
  const logger = pino({ level: 'warn', redact: ['node'] });
  const { version } = await fetchLatestBaileysVersion().catch(() => ({}));
  const restaurarConsole = silenciarLogsDeSessao();

  let socket;
  let encerrado = false;
  let reinicios = 0;
  let enviando = false;
  let aberta = false;
  let salvamentos = Promise.resolve();
  let temporizador;

  let concluir, falhar;
  const finalizado = new Promise((resolve, reject) => { concluir = resolve; falhar = reject; });

  const armarTimeout = ms => {
    clearTimeout(temporizador);
    temporizador = setTimeout(
      () => falhar(new Error(`Conexao demorou mais de ${ms / 1000} segundos. Execute novamente.`)),
      ms,
    );
  };

  async function enviarMensagem(sock) {
    const resultados = await comTimeout(
      sock.onWhatsApp(destinatario),
      TEMPO_OPERACAO_MS,
      'Timeout ao verificar o numero no WhatsApp.',
    );
    const contato = resultados?.find(r => r.exists && r.jid);
    if (!contato) {
      throw new Error(
        `O WhatsApp nao reconheceu o numero terminado em ${destinatario.slice(-4)}. ` +
        'Confira DDI, DDD e se o numero tem conta no WhatsApp.',
      );
    }
    console.log(`Numero reconhecido; usando o endereco WhatsApp retornado para ${mascarar(destinatario)}.`);

    const resumo = await enviar(
      {
        sendMessage: (jid, conteudo) => {
          if (!aberta) throw new Error('Conexao fechada.');
          return comTimeout(sock.sendMessage(jid, conteudo), TEMPO_OPERACAO_MS, 'Timeout de envio.');
        },
      },
      contato.jid,
      mensagem,
      destinatario,
    );
    if (resumo.incertas) process.exitCode = 1;
    await esperar(2000); // tempo para o WhatsApp finalizar o envio
  }

  function conectar() {
    console.log('Iniciando conexao com o WhatsApp...');
    armarTimeout(TEMPO_CONEXAO_MS);

    const sock = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      ...(version && { version }), // evita sobrescrever o default com undefined
      browser: Browsers.windows('Desktop'),
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getMessage: async () => undefined,
    });
    socket = sock;

    sock.ev.on('creds.update', () => {
      salvamentos = salvamentos
        .then(() => saveCreds())
        .catch(() => falhar(new Error('Nao foi possivel salvar a sessao.')));
    });

    sock.ev.on('connection.update', update => {
      if (encerrado || sock !== socket) return; // ignora sockets antigos

      if (update.connection === 'connecting') {
        console.log('Conectando... aguardando resposta do WhatsApp.');
      }

      if (update.qr) {
        armarTimeout(TEMPO_QR_MS); // da tempo de escanear o QR
        console.log('WhatsApp > Aparelhos conectados > Conectar aparelho. Escaneie o QR:');
        qrcode.generate(update.qr, { small: true });
      }

      if (update.connection === 'open' && !enviando) {
        aberta = true;
        enviando = true;
        clearTimeout(temporizador);
        console.log('Conectado! Enviando a mensagem para um numero...');
        enviarMensagem(sock).then(concluir, falhar);
      }

      if (update.connection === 'close') {
        aberta = false;
        if (enviando) return;

        const erro = update.lastDisconnect?.error;
        const codigo = erro?.output?.statusCode;

        if (codigo === DisconnectReason.loggedOut) {
          falhar(new Error('Sessao encerrada pelo WhatsApp. Apague a pasta auth/ e escaneie o QR novamente.'));
        } else if (ERROS_TRANSITORIOS.has(codigo) && reinicios < MAX_REINICIOS) {
          reinicios++;
          conectar();
        } else {
          falhar(new Error(
            `Conexao fechada${erro?.message ? `: ${erro.message}` : ''}. Confira a internet e a sessao em auth/.`,
          ));
        }
      }
    });
  }

  const interromper = () => { process.exitCode = 130; concluir(); };
  process.once('SIGINT', interromper);
  process.once('SIGTERM', interromper);

  try {
    conectar();
    await finalizado;
  } finally {
    encerrado = true;
    aberta = false;
    clearTimeout(temporizador);
    socket?.end(new Error('Encerramento local.'));
    await salvamentos;
    process.removeListener('SIGINT', interromper);
    process.removeListener('SIGTERM', interromper);
    restaurarConsole();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('Erro:', error.message);
    process.exitCode = 1;
  });
}
