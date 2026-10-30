# Pedido ao backend: otimização do broadcast de cobrança

> Status: implementado pelo backend. O frontend passou a consumir os campos e
> filtros diretamente em 30/10/2026. Manter este documento como referência do
> contrato e sincronizar `docs/openapi.json` com a implementação publicada.

## Contexto

A tela de Broadcast precisa exibir e pesquisar os seguintes dados de cada
fatura:

- duplicata (`DUPLIC`);
- parcela/prestação (`PREST`);
- código de cobrança (`CODCOB`);
- vencimento e valor.

Atualmente, `GET /prestacoes/broadcast-cobranca` retorna somente
`dataVencimento` e `valor` em cada fatura. Para completar os dados, o frontend
precisa carregar também `GET /prestacoes/` para uma janela de até 365 dias e
associar os registros por `CODCLI + DTVENC + VALOR`.

Essa solução provisória tem três problemas:

1. transfere um volume grande e duplicado de dados;
2. aumenta o tempo e a memória necessários para abrir a aba;
3. a associação é ambígua quando um cliente possui duas faturas com o mesmo
   vencimento e valor.

## Alteração solicitada

### 1. Completar `BroadcastCobrancaFatura`

Adicionar ao retorno de `GET /prestacoes/broadcast-cobranca`:

```json
{
  "duplic": 123456,
  "prest": "01",
  "codcob": "001",
  "dataVencimento": "2026-10-30",
  "valor": 149.90
}
```

Campos esperados:

- `duplic`: inteiro, obrigatório;
- `prest`: string ou `null`;
- `codcob`: string ou `null`;
- `dataVencimento`: data ISO, já existente;
- `valor`: número positivo, já existente.

`duplic + prest` deve identificar de forma estável a fatura dentro do cliente.

### 2. Adicionar filtros ao endpoint do broadcast

Parâmetros opcionais sugeridos:

| Parâmetro | Tipo | Comportamento |
|---|---|---|
| `search` | string | Busca parcial por nome, `CODCLI`, CPF/CNPJ, `DUPLIC`, `PREST` ou `CODCOB` |
| `venc` | date | Vencimento exato em formato ISO `AAAA-MM-DD` |
| `valormin` | decimal | Valor mínimo da fatura |
| `valormax` | decimal | Valor máximo da fatura |
| `codcob` | string | Código de cobrança exato |

Os filtros devem ser aplicados às faturas antes do agrupamento por cliente.
Clientes sem nenhuma fatura correspondente não devem aparecer no resultado.
Manter os parâmetros existentes `periodo`, `dias_passados` e `dias_futuros`.

### 3. Paginação e limites

Para evitar respostas muito grandes, adicionar paginação por cliente:

- `pagina`: inteiro, padrão `1`;
- `limite`: inteiro entre `1` e `100`, padrão `50`;
- `totalClientes` e `totalPaginas` na resposta.

Todas as faturas correspondentes dos clientes presentes na página devem ser
retornadas. O limite de 100 clientes do endpoint de envio permanece inalterado.

## Requisitos de desempenho

- Fazer o filtro e o agrupamento no banco/API, sem consultas N+1 por cliente.
- Evitar carregar todas as prestações de 365 dias quando houver busca, data ou
  valor informados.
- Avaliar índices para as colunas usadas no recorte e na busca, especialmente
  `CODCLI`, `DTVENC`, `DUPLIC`, `PREST` e `CODCOB`.
- Preservar a autenticação atual com `OAuth2PasswordBearer`.

## Compatibilidade

A mudança é retrocompatível: os campos atuais permanecem e os novos campos e
parâmetros são adicionados. Atualizar `docs/openapi.json` com o novo schema e os
filtros.

## Critérios de aceite

- A tela consegue exibir duplicata, parcela e código de cobrança usando apenas
  `GET /prestacoes/broadcast-cobranca`.
- Busca e filtros retornam somente faturas correspondentes.
- Duas faturas com mesmo cliente, vencimento e valor continuam distinguíveis.
- O frontend pode remover a chamada auxiliar a `GET /prestacoes/`.
