# @sgs/shared

Código compartilhado para o futuro app Expo: regras de rota do push (`push.ts`), validações do token do aparelho (`validation.ts`) e documentos GraphQL de registro (`graphql/device-tokens.ts`). Fonte TS pura, sem build.

> **Aviso:** Não importar @sgs/shared em apps/backend nem apps/frontend nesta fase: os builds Docker do staging usam contexto ./apps/<app> e quebrariam. Backend e frontend têm cópias locais (apps/backend/src/push/push-messages.ts e apps/frontend/src/infrastructure/native/push-route.ts); mudou aqui, mude lá.

Testes: `corepack pnpm --filter @sgs/shared test`.
