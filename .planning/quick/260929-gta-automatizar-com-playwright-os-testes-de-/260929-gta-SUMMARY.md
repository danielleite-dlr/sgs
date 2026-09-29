---
phase: quick-260929-gta
plan: 01
subsystem: e2e
tags: [playwright, e2e, equipe, ci, email-outbox]
requires: [02.1 equipe e profissionais]
provides:
  - "apps/e2e (@sgs/e2e): Playwright contra backend (3100) e frontend Vite (5180) reais"
  - "FileOutboxEmailAdapter: captura do token de convite via EMAIL_OUTBOX_DIR (nunca em production)"
  - "Job e2e no CI com artifact playwright-report em falha"
affects: [apps/backend/src/email, apps/frontend/src/pages/ProfissionaisPage.tsx, .github/workflows/ci.yml]
key-files:
  created:
    - apps/backend/src/email/file-outbox.adapter.ts
    - apps/backend/src/email/file-outbox.adapter.spec.ts
    - apps/e2e/ (package.json, playwright.config.ts, scripts/, support/, tests/, README.md)
  modified:
    - apps/backend/src/email/email.module.ts
    - apps/backend/src/config/env.schema.ts
    - apps/frontend/src/pages/ProfissionaisPage.tsx
    - apps/frontend/src/pages/__tests__/profissionais-page.test.tsx
    - .github/workflows/ci.yml
    - .planning/phases/02.1-.../02.1-VERIFICATION.md
requirements-completed: [EQUIPE-01, EQUIPE-02, EQUIPE-03, EQUIPE-05]
duration: ~1h20
completed: 2026-09-29
---

# Quick 260929-gta: Playwright para a verificação manual da Fase 02.1

Pacote `apps/e2e` com Playwright/Chromium que sobe backend NestJS e frontend Vite locais, faz o seed pela API GraphQL e automatiza os 4 itens de `human_verification` da fase 02.1, com outbox de e-mail em arquivo para capturar o token do convite e um job `e2e` no CI.

## Commits

| Hash | Mensagem |
| ---- | -------- |
| fd46381 | feat(e2e): outbox de e-mail em arquivo no backend (EMAIL_OUTBOX_DIR) |
| dd441a8 | feat(e2e): infraestrutura Playwright com launchers e seed pela API |
| 627169b | fix(equipe): fechar o menu de acoes ao abrir dialog de editar/desativar/gerar senha |
| 9381ae1 | test(e2e): cobrir com Playwright a verificacao manual da fase 02.1 |
| 8fa95f5 | fix(equipe): menu de acoes nao modal para nao travar pointer-events ao abrir dialog |
| e6fda22 | ci(e2e): rodar Playwright no CI e publicar relatorio em falha |

## Resultados

Playwright (local, contra Postgres/pgbouncer/Valkey locais):

- Suíte completa (`corepack pnpm --filter @sgs/e2e test:e2e`): **8 passed** (1 seed + smoke + 6 testes de equipe), 0 failed, 0 fixme.
- `--repeat-each=2 tests/equipe-`: **13 passed** (setup + 12).
- `--repeat-each=3 tests/equipe-` (após o segundo fix): **19 passed** (setup + 18).

Gate final (antes do último commit):

- Backend: lint limpo, typecheck limpo, unit 54/54 (7 suites), integração 146/146 (14 suites).
- Frontend: lint limpo, typecheck limpo, vitest 207/207 (21 arquivos).
- E2E: typecheck limpo.

## Bugs achados pelo E2E (corrigidos)

1. **Menu de Ações reabria após fechar o dialog** (`ProfissionaisPage.tsx`): `e.preventDefault()` no `onSelect` de Editar/Gerar senha/Desativar mantinha o DropdownMenu aberto por baixo do dialog, e ele reaparecia ao fechá-lo. Corrigido removendo o `preventDefault`, com teste vitest (RED confirmado antes do fix). Commit 627169b.
2. **`body { pointer-events: none }` preso (intermitente)**: uma execução falhou com o `html` interceptando cliques depois de abrir/fechar um dialog a partir do menu modal. Corrigido com `DropdownMenu modal={false}`. Depois: 19/19 em `--repeat-each=3` e suíte completa verde. Commit 8fa95f5. (Sem teste vitest: comportamento de bloqueio de ponteiro do Radix não é reproduzível no jsdom; é coberto pelo E2E.)

Nenhum `test.fixme`, nenhuma asserção afrouxada.

## Deviations from Plan

- **[Rule 1 - Bug]** Os dois bugs acima (corrigidos com a política do plano: pequeno e óbvio).
- **[Rule 3 - Blocking]** `pnpm --filter ... test:e2e -- <args>` repassa o `--` literal ao Playwright (`playwright test "--" ...`): filtros de arquivo funcionam, mas flags como `--repeat-each=2` viram filtro e não têm efeito. O uso correto é **sem `--`**: `corepack pnpm --filter @sgs/e2e test:e2e --repeat-each=2 tests/equipe-`. O CI só usa `test:e2e` sem args. README documenta.
- **[Rule 3 - Blocking]** `playwright install --with-deps` travou no prompt do `needrestart` (whiptail) dentro do apt. Reexecutado com `DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a`. Sem impacto no repositório (o CI usa runner limpo).
- **[Rule 1 - Bug de teste]** O formulário de login valida em `onBlur` (`isValid`), então `loginViaUi` faz `blur()` no campo de senha antes de enviar. O cadastro pela UI exige ao menos uma categoria para profissional (o seed passa `categoryIds`, e o spec marca a categoria).
- **Formatação acidental**: um `prettier --write` inicial reformatou `env.schema.ts` no primeiro commit; o commit dd441a8 restaura o arquivo e deixa só a linha nova de `EMAIL_OUTBOX_DIR`. Os demais arquivos de e-mail tocados pelo prettier foram revertidos e não entraram em commit.
- Plan-checker 1: Task 1 dividida em dois commits (backend outbox, depois apps/e2e).
- Plan-checker 3: o texto esperado do dialog de desativação usa as mesmas options do `formatStartsAt` mais `timeZone: 'America/Sao_Paulo'` (igual ao `timezoneId` do config).
- Task 2 dividida em fix + spec (627169b antes de 9381ae1).
- **Item 4 da VERIFICATION** ("ações aparecem e o backend devolve FORBIDDEN") foi resolvido pela quick 260929-dek: o teste trava o comportamento entregue (MANAGER vê "Cadastrar profissional" e nenhuma Ação; ATTENDANT não vê nada; `deactivateMember` do MANAGER é negada e o membro segue ativo).
- Item 1 usa dois caminhos: cadastro direto pela UI (o botão de convite saiu da UI na quick dvr) e convite disparado por API + aceite em `/convite/:token` pela UI.

## Não feito (por instrução do orquestrador)

- **Push e acompanhamento do CI** (parte final da Task 3): não foi feito `git push` nem deploy. O job `e2e` do `ci.yml` foi validado só localmente (YAML parseia, contém `playwright install --with-deps chromium`, `upload-artifact` e `test:e2e`; `actionlint` não está instalado). Precisa ser observado no GitHub Actions no primeiro push (pontos de risco: instalação de deps do browser no runner, ordem migrations/prisma generate antes do `nest build`, env das URLs do Postgres na 5432/pgbouncer 5433).
- Cache de `~/.cache/ms-playwright` no CI (opcional no plano) não foi adicionado.
- STATE.md/ROADMAP.md não foram tocados. Nenhum container `sgs_stg_*` nem `.env.staging` foi tocado (conferido com `docker ps` ao final).

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos criados/commits conferidos: apps/e2e/{package.json,playwright.config.ts,scripts,support,tests,README.md}, apps/backend/src/email/file-outbox.adapter{,.spec}.ts, e commits fd46381, dd441a8, 627169b, 9381ae1, 8fa95f5, e6fda22 presentes no `git log`.
