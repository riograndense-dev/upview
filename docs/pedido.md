# Pedido ao agente backend: preparação do broadcast de cobrança

## Objetivo

Criar um endpoint agregado para a tela de broadcast de cobrança. Hoje o frontend
precisa buscar todas as prestações e depois executar uma requisição por cliente
para obter o telefone. Além de lento, esse fluxo pode deixar clientes elegíveis
fora da tela quando clientes sem telefone ocupam o limite intermediário.

O limite de 100 pertence **somente ao lote enviado à API do WhatsApp**. Clientes
sem telefone válido e clientes exibidos, mas não selecionados, não podem consumir
esse limite.

## Novo endpoint

`GET /prestacoes/broadcast-cobranca`

Requer o mesmo Bearer token dos demais endpoints privados.

Query params:

- `periodo`: enum obrigatório: `todas`, `vencidas`, `hoje`, `proximas` ou `abertas`;
- `search`: texto opcional para busca parcial por nome, CPF/CNPJ ou código do
  cliente. Deve ser usado com `periodo=abertas` para a busca global da tela;
- `dias_passados`: inteiro de 0 a 365, default `365`;
- `dias_futuros`: inteiro de 0 a 365, default `3`.

Regras de período, considerando a data local da aplicação:

- `vencidas`: vencimento anterior a hoje, dentro de `dias_passados`;
- `hoje`: vencimento igual a hoje;
- `proximas`: vencimento posterior a hoje, até `dias_futuros`;
- `todas`: união dos três casos acima.
- `abertas`: ignora as janelas de dias e retorna todas as prestações em aberto
  dos clientes correspondentes a `search`, independentemente do vencimento.

Quando `periodo=abertas`, `search` deve ser obrigatório e não vazio para evitar
uma consulta global acidental. A busca continua retornando uma resposta agregada
em uma única requisição, sem chamadas adicionais por cliente.

Retornar apenas prestações abertas (`DTBAIXA` nulo), com `CODCLI`, vencimento
válido e valor positivo. Agrupar por cliente, ordenar as faturas por vencimento e
os clientes pelo vencimento mais antigo. Não truncar a quantidade de clientes por
causa do limite de envio de 100.

Resposta `200`:

```json
{
  "geradoEm": "2026-10-16T14:30:00-03:00",
  "clientes": [
    {
      "codcli": 123,
      "nome": "Cliente Exemplo",
      "cnpj": "12.345.678/0001-90",
      "celular": "5551999999999",
      "telefoneOriginal": "(51) 99999-9999",
      "telefoneValido": true,
      "faturas": [
        {
          "dataVencimento": "2026-10-16",
          "valor": 149.9
        }
      ]
    },
    {
      "codcli": 456,
      "nome": "Cliente sem telefone",
      "celular": null,
      "telefoneOriginal": "",
      "telefoneValido": false,
      "faturas": [
        {
          "dataVencimento": "2026-10-17",
          "valor": 80.0
        }
      ]
    }
  ],
  "totalClientes": 2,
  "totalComTelefone": 1,
  "totalSemTelefone": 1
}
```

`celular` deve vir normalizado somente com dígitos e ser `null` quando nenhum dos
telefones cadastrados tiver entre 10 e 15 dígitos. O backend deve fazer a junção
com clientes em uma única consulta (ou em número constante de consultas), evitando
o padrão N+1. Índices e cache curto podem ser usados, desde que alterações em
prestações e telefones não fiquem desatualizadas por mais de 60 segundos.

## Envio

Manter `POST /wpp/api/v1/messages/send` com no máximo 100 itens em `clientes`.
Validar o limite sobre o array recebido — que contém apenas os destinatários
selecionados — e rejeitar telefone inválido antes de iniciar os envios. Clientes
apenas listados pelo endpoint de preparação não fazem parte do lote.

Conservar o formato atual de cada item enviado:

```json
{
  "nome": "Cliente Exemplo",
  "celular": "5551999999999",
  "faturas": [
    { "dataVencimento": "2026-10-16", "valor": 149.9 }
  ]
}
```

## Critérios de aceite

- a abertura da tela executa uma única requisição de preparação, sem uma chamada
  adicional para cada cliente;
- a busca por nome, CPF/CNPJ ou código encontra clientes com qualquer fatura em
  aberto, mesmo fora das janelas dos filtros predefinidos, em uma única requisição;
- todos os clientes do período são retornados, inclusive os sem telefone válido;
- 150 clientes podem ser listados e o operador pode escolher quaisquer 100 deles;
- clientes sem telefone não podem ser selecionados e não consomem o limite;
- ao desmarcar um dos 100 selecionados, outro cliente válido é liberado para seleção;
- o POST aceita de 1 a 100 selecionados e rejeita 101 com erro de validação claro;
- datas de fronteira (`ontem`, `hoje`, `amanhã` e terceiro dia) possuem testes;
- a especificação OpenAPI é atualizada com os schemas e exemplos acima.
