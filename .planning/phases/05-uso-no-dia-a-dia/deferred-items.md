# Itens adiados da fase 05

## 05-10 (Agenda no celular, lote 2)

- **`cn()` não reconhece os espaçamentos do tema (`xs`..`3xl`).** O `tailwind-merge` de `apps/frontend/src/lib/cn.ts` não sabe que `p-lg` e `p-0` são do mesmo grupo, então mantém os dois e quem vence é a ordem do CSS (`p-lg`). Efeito: todo `DialogContent` com `className="p-0"` continua com 24 px de margem interna (visível no diálogo de agendamento no computador). No 05-10 o celular foi corrigido de forma local (`max-sm:p-0` no `VisitFormDialog`) para não mudar o computador nem outras telas fora do lote. Correção de causa: registrar `spacing` no `extendTailwindMerge` (`theme: { spacing: ['xs','sm','md','lg','xl','2xl','3xl'] }`), o que muda o visual de todos os diálogos `p-0`; precisa de aprovação da usuária.

## 05-11 (Comanda e caixa, lote 1)

- **`Card` base limitado a 400 px.** `apps/frontend/src/components/ui/card.tsx` tem `w-full max-w-[400px]` no estilo padrão, então todo cartão que não sobrescreve `max-w` fica estreito (era a causa da lista de comandas espremida, UX-07). No 05-11 só a lista de comandas foi corrigida, de forma local (`max-w-none` no `Card` da lista). Correção de causa: tirar o `max-w-[400px]` do `Card` base e colocar o limite só onde ele é desejado; isso muda a largura de outros cartões fora do lote (financeiro, clientes, configurações) e precisa de aprovação da usuária.

- (05-13) ~~`ux-agenda-celular.spec.ts` instável~~ — resolvido: a causa era a falta de `shrink-0` nos botões do painel de filtros (encolhiam para 43,99 px com muitas profissionais). Corrigido em 780bc90.
