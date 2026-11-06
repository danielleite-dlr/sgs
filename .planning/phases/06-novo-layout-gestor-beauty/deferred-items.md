# Itens adiados — Fase 6

## 06-04

- **`cn` não funde os tokens de espaço customizados** (`src/lib/cn.ts`): `cn('p-lg gap-md', 'p-0 gap-0')`
  devolve as quatro classes, e no CSS `p-lg`/`gap-md` vencem. O `DialogContent` tem `p-lg gap-md`
  por padrão, então qualquer diálogo que passe `p-0` ou `gap-0` continua com 24 px de padding e
  16 px de gap no computador. No 06-04 o `VisitFormDialog` contornou com `sm:p-0 sm:gap-0
  max-sm:gap-0`. Correção global: registrar a escala `xs, sm, md, lg, xl, 2xl, 3xl` no
  `extendTailwindMerge` (`theme.spacing`). Fica fora do 06-04 porque muda o resultado de `cn` em
  todos os componentes e pede uma rodada própria de conferência visual.
  - **Resolvido em 2026-11-06** (antes do 06-05, a pedido da usuária): escala `xs…3xl` registrada em `theme.spacing` do `extendTailwindMerge`, com `src/lib/__tests__/cn.test.ts`. O contorno `sm:p-0 sm:gap-0` do `VisitFormDialog` continua inofensivo.
