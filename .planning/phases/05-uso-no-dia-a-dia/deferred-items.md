# Itens adiados da fase 05

## 05-10 (Agenda no celular, lote 2)

- **`cn()` não reconhece os espaçamentos do tema (`xs`..`3xl`).** O `tailwind-merge` de `apps/frontend/src/lib/cn.ts` não sabe que `p-lg` e `p-0` são do mesmo grupo, então mantém os dois e quem vence é a ordem do CSS (`p-lg`). Efeito: todo `DialogContent` com `className="p-0"` continua com 24 px de margem interna (visível no diálogo de agendamento no computador). No 05-10 o celular foi corrigido de forma local (`max-sm:p-0` no `VisitFormDialog`) para não mudar o computador nem outras telas fora do lote. Correção de causa: registrar `spacing` no `extendTailwindMerge` (`theme: { spacing: ['xs','sm','md','lg','xl','2xl','3xl'] }`), o que muda o visual de todos os diálogos `p-0`; precisa de aprovação da usuária.
