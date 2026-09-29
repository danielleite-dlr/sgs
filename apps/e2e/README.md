# @sgs/e2e

Testes end-to-end com Playwright (Chromium) contra o backend NestJS e o frontend Vite reais, sem mocks de GraphQL.

## Pré-requisitos

- Containers `sgs_postgres`, `sgs_pgbouncer` e `sgs_valkey` de pé (`docker compose up -d postgres pgbouncer valkey`).
- Migrations aplicadas e Prisma client gerado (`pnpm --filter @sgs/backend prisma:migrate:deploy` / `prisma:generate`).
- `.env` na raiz do repositório (copie de `.env.example`). Ele é lido linha a linha, e o `process.env` tem prioridade (é assim que o CI injeta as URLs).
- Chromium do Playwright: `corepack pnpm --filter @sgs/e2e exec playwright install --with-deps chromium`

## Rodando

```bash
corepack pnpm --filter @sgs/e2e test:e2e                                   # tudo
corepack pnpm --filter @sgs/e2e test:e2e tests/equipe-                     # só os specs de equipe
corepack pnpm --filter @sgs/e2e test:e2e --repeat-each=2 tests/equipe-     # estabilidade
corepack pnpm --filter @sgs/e2e report                                     # abre o relatório HTML
```

Não use `--` antes dos argumentos: o pnpm o repassa literalmente ao Playwright e as flags seguintes viram filtros de arquivo.

O Playwright sobe sozinho (`webServer`):

| Serviço  | Porta | Observação |
| -------- | ----- | ---------- |
| backend  | 3100  | `nest build` + `node dist/main.js` via `scripts/start-backend.mjs` |
| frontend | 5180  | Vite com `VITE_API_URL=http://localhost:3100` |

As portas são exclusivas do E2E (o dev usa 3000/5173), então um servidor já rodando nelas é reaproveitado fora do CI.

## Como funciona

- **Seed pela API:** `tests/seed.setup.ts` roda como projeto `setup` (depois do webServer subir). O único atalho é o bootstrap do platform admin pelo script oficial `create-platform-admin`; o resto (org, owner, MANAGER, ATTENDANT, profissionais, categoria, serviço, cliente, agendamento futuro) usa a API GraphQL pública. O resultado fica em `.e2e-state/seed.json`.
- **Banco persistente:** cada execução cria uma organização nova (sufixo único nos e-mails e nomes). Nada é limpo.
- **Outbox de e-mail:** o token do convite só existe em hash no banco, então o backend do E2E sobe com `EMAIL_OUTBOX_DIR=apps/e2e/.e2e-state/outbox` e grava cada e-mail como JSON nesse diretório (`FileOutboxEmailAdapter`). `support/outbox.ts` lê o link `/convite/:token` de lá. O outbox é ignorado quando `NODE_ENV=production`, e o E2E força `RESEND_API_KEY` vazio: nenhum e-mail real sai.
- **"Sem recarregar":** `markNoReload`/`expectNoReload` (em `support/ui.ts`) provam que a navegação entre telas foi SPA pura.
- **Fuso e idioma:** `pt-BR` e `America/Sao_Paulo` fixos no `playwright.config.ts`.

## CI

O job `e2e` de `.github/workflows/ci.yml` sobe postgres/pgbouncer/valkey, aplica as migrations, instala só o Chromium e roda `test:e2e`. Em falha publica `playwright-report` e `test-results` como artifact (7 dias).
