# Phase 12: Ajustar cadastro de agendamento - Research

**Researched:** 2026-11-27
**Domain:** Frontend React 19 (modal `VisitFormDialog`), helper puro `visit-form.ts`, componente de calendário
**Confidence:** MEDIUM-HIGH (código lido linha a linha; causa raiz do "mesmo horário" NÃO reproduzida só por leitura, ver Q1)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** O select "Pacote" no fim do modal (`#visit-package`) **sai**. O pacote passa a ser escolhido na linha de serviço, **ao lado do select de Serviço**: cada linha alterna entre **Serviço | Pacote** (um ou outro).
- **D-02:** Escolher um pacote numa linha faz ela virar as linhas dos serviços do pacote, **a partir do horário e da profissional daquela linha**. As linhas acima e abaixo (avulsas) continuam. Dá para misturar: pacote + avulsos, antes ou depois.
- **D-03:** **Um pacote por agendamento.** Depois de escolher um pacote numa linha, a opção "Pacote" some das outras linhas (ou fica desabilitada) até ele ser removido. Backend continua com um `packageId` só em `CreateVisitInput` e não muda.
- **D-04:** Remover o pacote (voltar a linha para "Serviço" ou remover as linhas dele) tira as linhas expandidas daquele pacote e limpa o `packageId`. Critério do planner: marcação visual ("do pacote X") e como a remoção funciona, desde que nenhuma linha avulsa se perca.
- **D-05:** A lista de pacotes não muda (quick 261126-w01, `visitPackageOptions`): sociais aparecem para qualquer cliente; noiva/debutante só para a cliente do contrato, na data do evento. Mudou cliente ou data e o pacote deixou de valer: o pacote sai e volta a ser linha de serviço, como hoje no `useEffect`.
- **D-06:** Ao escolher o pacote, os serviços entram **em sequência** (1º no horário da linha; cada seguinte começa quando o anterior termina, duração padrão). Hoje `expandPackageLines` já faz isso partindo de `lines[0].time || '09:00'` e trocando todas as linhas. O planner deve investigar por que no staging ficaram no mesmo horário e corrigir.
- **D-07:** Sequência montada **só no momento da escolha**. Depois, horário e duração editáveis à mão, sem cascata.
- **D-08:** Campo Data continua aceitando digitação `dd/mm/aaaa` (máscara atual), com **ícone de calendário ao lado que abre calendário do mês num Popover**, visual Gestor Beauty (roxo, pt-BR, semana começando no domingo). O dia escolhido preenche o campo no mesmo formato.
- **D-09:** Não usar `<input type="date">`. Fica a critério do planner adicionar `react-day-picker` (Calendar do shadcn) ou montar grade própria. Componente reutilizável (`components/ui/calendar` ou `DateField`).

### Claude's Discretion
- Forma do seletor Serviço | Pacote na linha (abas pequenas, segmented control ou select com tipo), cabendo no celular (alvos >= 44 px, UX-03/UX-04 da fase 6).
- Marcação visual das linhas que vieram do pacote.
- Biblioteca do calendário.

### Deferred Ideas (OUT OF SCOPE)
- Vários pacotes no mesmo agendamento (precisaria de backend e comanda com vários pacotes).
- Cascata automática de horários ao editar uma linha.
- Fora do escopo: cliente, sinal, observações, prioridade de profissional (fase 11), cronograma da noiva, cobrança de vários pacotes.
</user_constraints>

<phase_requirements>
## Phase Requirements

Sem IDs de requisito (TBD). Cobrir D-01..D-09.

| ID | Descrição | Research Support |
|----|-----------|------------------|
| D-01..D-04 | Pacote na linha, expansão no lugar, um por visita, remoção | Q2 (modelo de estado) |
| D-05 | Pacote some se cliente/data mudam | Q2 (efeito existente em `VisitFormDialog.tsx:546`) |
| D-06/D-07 | Sequência no momento da escolha | Q1 (causa raiz + teste) |
| D-08/D-09 | Calendário no campo Data | Q3 |
</phase_requirements>

## Summary

O backend NÃO re-tempora os itens: `createVisit` (`apps/backend/src/appointments/visits.ts`) usa `startsAt/endsAt` de cada item como vieram (linhas 96-229) e o bloco de pacote (linhas 277-320) só valida que cada serviço pertence ao pacote e chama `expandPackageItems` (cobrança). O cronograma da noiva (`bridal-schedule.ts`) só roda quando `input.bridal` e é incompatível com `packageId` (visits.ts:73). Logo, no caminho social (pacote de visita) o horário gravado é exatamente o do formulário.

No frontend, `expandPackageLines` (`lib/visit-form.ts:111-131`) está correto e já testado (`visit-form.test.ts:75`). A leitura estática NÃO acha um defeito que faça os serviços colapsarem no mesmo horário no caminho "escolher pacote". Os caminhos reais que geram "mesmo horário" estão listados em Q1; o mais provável é a combinação de (a) linha 0 com hora vazia, (b) `Adicionar serviço` criar linha com hora `''`, (c) edição manual da hora da linha 0 sem cascata (D-07) deixando a pessoa achar que "juntou". É preciso reproduzir com um teste de componente (Q1) antes de declarar a causa; o plano deve ter essa tarefa de reprodução primeiro.

Calendário: recomendo **grade própria** (sem dependência nova). `react-day-picker` está em 10.0.2 (latest) e puxa `date-fns` ^4 + `@date-fns/tz`, nada disso está no `package.json` do frontend (o CLAUDE.md cita date-fns, mas ele não está instalado), ~1 MB unpacked, e exige mapear classNames para Tailwind. Uma grade de mês de ~100 linhas com helper puro testável atende D-08 melhor.

**Primary recommendation:** Reescrever o estado de linhas com `id` estável e `fromPackage: boolean`, expandir no índice com função pura `expandPackageAt(lines, index, pkg)` em `visit-form.ts`, remover o select `#visit-package`, e criar `components/ui/date-field.tsx` (Input + botão ícone + Popover + grade própria) sem nova dependência.

## Standard Stack

### Core (já no projeto, nada a instalar)
| Library | Versão | Uso |
|---------|--------|-----|
| react / react-dom | ^19.0.0 | (CLAUDE.md diz 18, mas o package.json é 19) |
| @radix-ui/react-popover | ^1.1.15 | base do calendário; wrapper em `components/ui/popover.tsx` |
| lucide-react | ^0.475.0 | ícone `CalendarDays`, `ChevronLeft/Right` |
| tailwindcss | ^3.4.13 | tokens `primary-*` (roxo `#7E22CE`, 100 `#F3E8FF`, 800 `#581C87`) |
| vitest ^2.1.3 + @testing-library/react ^16 + user-event ^14.6.8 + jsdom ^25 | | testes |

### Alternatives Considered
| Em vez de | Poderia | Tradeoff |
|-----------|---------|----------|
| Grade própria | `react-day-picker` 10.0.2 (shadcn Calendar) | Compatível com React 19 (peer `>=16.8`), locale `react-day-picker/locale` (`ptBR`), mas adiciona date-fns 4 + @date-fns/tz, CSS/classNames a mapear, e testes em jsdom dependem do markup deles. Só vale se for preciso intervalo, múltiplos meses ou navegação por ano; D-08 não pede. |
| `<input type="date">` | — | PROIBIDO por D-09. |

**Installation:** nenhuma. (Se o planner escolher react-day-picker: `corepack pnpm --filter @sgs/frontend add react-day-picker@^10` e importar `ptBR` de `react-day-picker/locale`; versão verificada com `npm view` em 2026-11-27, publicada 2026-09-30.)

## Architecture Patterns

### Q1. Causa raiz "serviços no mesmo horário" (achados com arquivo:linha)

Tudo em `apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx` salvo indicação.

| # | Hipótese | Evidência | Veredito |
|---|----------|-----------|----------|
| 1 | `expandPackageLines` não sequencia | `lib/visit-form.ts:111-131` soma `defaultDurationMinutes` a cada serviço; teste `visit-form.test.ts:75-90` passa | Descartada |
| 2 | Hora da linha 0 vazia | `choosePackage` usa `lines[0]?.time \|\| '09:00'` (linha 679). Vazia vira 09:00, ainda sequencia | Não colapsa, mas surpreende (agenda aberta pelo botão sem `initialTime` → `seedTime` devolve `''`, linha 100). Em D-02 deve partir da hora da própria linha; se vazia, usar a hora da última linha preenchida ou o fallback, e mostrar o resultado |
| 3 | Efeito de reset reescreve linhas | efeito `[open, initialTime, prefill]` (551-570) recria `lines` e zera `packageId`. `modalSeed` é `useState` em `SchedulePage.tsx:756`, identidade estável | Descartada (só dispara ao abrir) |
| 4 | Efeito do pacote inválido | `useEffect` 546-549 chama `choosePackage('')` se `packagesData` existe e o pacote sumiu. Colapsa para UMA linha vazia (669-671), não para mesmo horário | Descartada para "mesmo horário"; atenção D-05 |
| 5 | Sugestão de profissional (fase 11) altera hora | efeito 227-241 muda só `professionalId`/`variantId`/`duration` (via `applyVariant`, linha 220), nunca `time` | Descartada para hora. `applyVariant` pode mudar a duração (variante com duração diferente) SEM recalcular as horas seguintes: horários ficam com buracos/sobreposição, sem cascata (D-07) |
| 6 | Backend re-tempora | `visits.ts` não altera `startsAt/endsAt` de itens; cronograma só com `input.bridal` e proibido junto de `packageId` (visits.ts:73) | Descartada |
| 7 | Caminho de prefill (grupo da noiva) | `prefill.serviceIds.map(... emptyLine(seedTime(initialTime)))` (556-561): TODAS as linhas nascem com a MESMA hora | **Caminho real de "mesmo horário"**, fora de escopo (cronograma/noiva), mas explica relatos se a atendente abriu pelo grupo da noiva |
| 8 | `Adicionar serviço` | `emptyLine('', last.professionalId)` (967-968): hora vazia; a atendente digita a mesma hora | Caminho real de hora igual/vazia entre avulsos |
| 9 | Sobreposição visual na grade | mesma profissional em linhas consecutivas não sobrepõe se sequenciais | Descartada |
| 10 | Build de staging defasado | `expandPackageLines` existe desde 573c815 (2026-11-02) | Improvável |

**Causa mais provável (MEDIUM):** a pessoa escolheu o pacote, as linhas entraram sequenciais, mas (a) ela editou a hora da linha 0 depois (outras ficam, sem cascata) ou a variante mudou a duração, ou (b) usou fluxo do item 7/8. NÃO há defeito reproduzível no caminho puro. **Como testar (primeira tarefa do plano):**
1. Teste de componente `visit-form-package.test.tsx` com `MockedProvider` (mocks de `ServicesQuery`, `VisitPackagesQuery` com 2-3 serviços de durações 60/30/45, `ClientsList`), abrir com `initialTime {hour:10, minute:0}`, escolher o pacote na linha 0 e assertar `visit-line-0-time=10:00`, `visit-line-1-time=11:00`, `visit-line-2-time=11:30`.
2. Repetir sem `initialTime` (hora vazia) e com linha 0 já com serviço avulso.
3. Playwright no staging com `zz-tmp-*.spec.ts` (padrão do projeto) imprimindo as horas das linhas após a escolha.
Se o teste passar (esperado), a "correção" de D-06 vira: nova função pura + teste de regressão + exibir a hora clara quando a linha de origem estava vazia.

Também notar: `expandPackageLines` ignora `displayOrder` do pacote (o backend já ordena por `displayOrder`, `packages.service.ts:113`), então a ordem fica correta; manter, mas documentar. `quantity > 1` é deduplicado (uma linha por serviço): manter (comportamento atual; o backend lida com unidades extras, visits.ts:~320).

### Q2. Modelo de estado para pacote na linha

Hoje: `packageId` (string) separado de `lines`; `lockedService`/`canRemove` dependem de `selectedPackage !== null` (linhas 972-973); `visit-add-line` some com pacote (962).

Proposta (puro, testável, sem mexer no backend):
```ts
// lib/visit-form.ts
export interface LineState {  // hoje definido no VisitFormDialog; mover/exportar
  id: string;                 // estável (crypto.randomUUID ou contador): substitui key={i}
  kind: 'service' | 'package'; // modo escolhido na linha
  fromPackage: boolean;        // linha gerada por pacote
  // ... campos atuais
}
export function expandPackageAt(lines, index, pkg, fallbackTime): LineState[]
//  - base = lines[index]; hora = base.time || última hora preenchida acima || fallbackTime; profissional = base.professionalId
//  - substitui lines[index] por expandPackageLines(...) marcadas fromPackage:true
//  - as demais linhas permanecem intactas
export function removePackageLines(lines): LineState[]
//  - tira fromPackage; se sobrar zero linhas, devolve [emptyLine]; avulsas intactas (D-04)
```
Regras:
- `packageId` continua estado único no Dialog (envio inalterado: `packageId: packageId || null`, linha 708). Derivar `hasPackage = packageId !== ''`.
- Escolha numa linha: `setPackageId(id)` + `setLines(expandPackageAt(...))`. Linhas do pacote: serviço travado (`lockedService`) mas hora, duração, profissional e variante editáveis (D-07). Cada linha de pacote com selo "do pacote X" (texto + `data-testid="visit-line-N-package-badge"`).
- Voltar a linha de origem para "Serviço" (o seletor Serviço|Pacote da PRIMEIRA linha `fromPackage`, ou botão "Remover pacote" no cabeçalho do grupo de linhas do pacote) chama `removePackageLines` e `setPackageId('')`. Recomendo UM controle de remoção do pacote (botão "Remover pacote" no selo da primeira linha do pacote), mais simples que cada linha ter lixeira própria; linhas fromPackage não têm lixeira individual (senão o backend rejeita itens faltando? Não rejeita; mas manter consistente). A linha do meio removida individualmente não é perigosa para o backend (só valida `SERVICE_NOT_IN_PACKAGE`, visits.ts:~300), então a lixeira pode ficar habilitada; decisão do planner, mas "sem linha avulsa perdida" é o invariante.
- D-03: a opção "Pacote" de cada linha fica `disabled` (e com texto "um pacote por agendamento") quando `hasPackage` e a linha não é `fromPackage`. Prefira desabilitar a esconder (previsível, testável).
- Seletor Serviço|Pacote: segmented control de 2 botões (`role="radiogroup"` ou `radio-group.tsx` já existente em `components/ui`), `min-h-[44px]`, acima do select (no celular a coluna do grid é `grid-cols-1`). Quando "Pacote" está ativo, o select de serviço é trocado por um select de pacote (mesma `SELECT_CLASS`) com `packagesData.packages`; sem pacotes disponíveis, a aba "Pacote" fica desabilitada com dica.
- D-05: manter o `useEffect` 546-549 mas chamar `removePackageLines` + `setPackageId('')` (não mais `choosePackage('')`, que hoje descarta TODAS as linhas e as troca por uma vazia, linha 669-671: isso perderia avulsos). Atenção: o efeito depende de `packagesData` existir; durante o refetch por mudança de cliente/data o Apollo devolve `data` undefined, então não dispara; garantir via teste com `rerender`/mudança de data.
- `key={i}` (linha 977) deve virar `key={line.id}`: `LineRow` guarda estado interno (debounce `debouncedKey`, consulta de sugestão e efeito de pré-seleção); ao inserir/remover linhas no meio, índices mudam e o estado vaza para a linha errada.
- Efeito de reset (551) e `reset()` precisam limpar `kind`/`fromPackage`/`packageId`.
- `serviceChips` e `lockedService` hoje dependem de `selectedPackage`; reescrever para `line.fromPackage`.
- Medir rolagem: o efeito 588 depende de `packageId` e `lines.length`; manter.

### Q3. Calendário
- Local: `apps/frontend/src/components/ui/date-field.tsx` (+ helper puro `lib/month-grid.ts` ou dentro do próprio arquivo) exportando `DateField` (value `dd/mm/aaaa`, `onChange(br)`), reutilizando `maskDateBR`, `brDateToIso`, `isoToBrDate` (`features/operations/lib/input-masks.ts`; considerar re-exportar para `lib/` compartilhado, pois `components/ui` não deve importar de `features`; ou receber a máscara por prop).
- Estrutura: `Popover` > `PopoverTrigger asChild` (botão ícone `CalendarDays`, `h-11 w-11`, `aria-label="Abrir calendário"`, `data-testid="visit-date-picker"`) ao lado do `Input#visit-date` (manter `data-testid="visit-date"`, `maxLength=10`). `PopoverContent` com `w-auto p-sm`, grade 7 colunas (D S T Q Q S S), cabeçalho com mês/ano em pt-BR (`Intl.DateTimeFormat('pt-BR', {month:'long', year:'numeric'})`, sem dependência), botões anterior/próximo (44 px), dia selecionado `bg-primary text-white`, hoje com `ring-primary-300`, dias fora do mês `text-neutral-400`. Cada dia `button` com `aria-label` ("27 de novembro de 2026"), `aria-pressed` no selecionado; ao escolher, `onChange(isoToBrDate(iso))` e fecha o Popover. Mês inicial: mês da data digitada se válida, senão hoje.
- Construir datas SEMPRE com `new Date(y, m, d)` local e formatar a mão (o projeto já faz assim em `lineInterval`); não usar `toISOString().slice(0,10)` (desliza um dia em UTC-3).
- Dentro do Dialog Radix: `PopoverContent` usa Portal; funciona com `Dialog` (já há `Popover` usado em outras telas); verificar z-index (`z-50` igual ao do Dialog: pode ficar atrás; usar `z-[60]` se necessário) e que no mobile full-screen o popover não estoura a viewport (`collisionPadding={8}`, `avoidCollisions`). Teste visual com Playwright.
- Mobile (UX-03/UX-04, fase 6): botão do calendário e dias com alvo >= 44 px (`h-11 w-11`; grade com 7 x 44 = 308 px cabe em 360 px; usar `w-[min(20rem,calc(100vw-1rem))]`). O Dialog é `h-[100dvh]` full-screen no celular (`VisitFormDialog.tsx:~766`). O campo `visit-date` está em `col-span-12 sm:col-span-5` dentro do grid `visit-when` de 12 colunas (teste `novo-agendamento-gestor-beauty.test.tsx:217` exige que `visit-date`, hora e duração estejam dentro de `visit-when` com `grid-cols-12`): o botão-ícone deve ficar DENTRO do `dateField` (wrapper `relative` com botão `absolute right-0` ou flex), sem quebrar essa asserção.
- Regra de memória: nunca importar `tailwind.config.ts` em `src`; usar só classes Tailwind (`bg-primary`, `text-white`, `bg-primary-100`...). Os testes de tokens leem o config como texto (`styles/__tests__/tokens-gestor-beauty.test.ts`), não importar.
- jsdom: Radix Popover abre em jsdom com `user.click`; `PopoverContent` precisa de `ResizeObserver` (verificar `src/test-setup.ts`; se faltar, `Popover` já é usado em outros testes? confirmar com `grep -rn "ResizeObserver" src/test-setup.ts`).

### Anti-Patterns to Avoid
- Trocar todas as linhas ao escolher o pacote (comportamento atual) → perde avulsos (viola D-02/D-04).
- `key={i}` com inserção/remoção no meio.
- Cascata de horários ao editar (D-07 proíbe).
- Mexer em `CreateVisitInput`/backend.

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Popover/posicionamento/foco | overlay próprio | `components/ui/popover.tsx` (Radix) | foco, Esc, colisão, portal |
| Máscara e conversão de data | regex novo | `maskDateBR`, `brDateToIso`, `isoToBrDate` | já testadas; data inexistente tratada |
| Sequência do pacote | contas de hora inline | `expandPackageLines` (reaproveitar internamente) | já coberta por teste |
| Seleção exclusiva Serviço/Pacote | botões custom sem a11y | `radio-group.tsx` (Radix) ou `role=radiogroup` como `ProfessionalSegmented` já faz no modal | setas de teclado e `aria-checked` já padronizados (teste `novo-agendamento-gestor-beauty.test.tsx:200-215`) |

## Runtime State Inventory
Não aplicável (feature de UI, sem rename/migração). Nada armazenado, nenhum serviço, segredo ou artefato de build envolvido.

## Common Pitfalls

1. **Perder avulsos ao remover o pacote**: o `choosePackage('')` atual descarta tudo. Usar `removePackageLines`. Teste: avulso + pacote + avulso, remover pacote, avulsos intactos.
2. **Hora vazia na linha de origem**: `''` não é hora válida (`parseTime`); definir regra de fallback e testar.
3. **Fuso na data do calendário** (UTC-3): construir com componentes locais.
4. **`applyVariant` muda a duração sem cascata**: aceitável por D-07, mas mostrar a hora de fim ou deixar claro; não "consertar" com cascata.
5. **Efeito D-05 com refetch**: não zerar o pacote enquanto `packagesData` está carregando.
6. **Teste existente `visit-when`**: o botão do calendário não pode tirar `visit-date` do grid.
7. **Remoção do select `#visit-package`**: e2e/testes que o referenciem (hoje nenhum; ver Q4).
8. **Variantes `prefill` (noiva)**: `suggestEnabled={!prefill}` e linhas do grupo; a aba "Pacote" não deve aparecer/atrapalhar no fluxo do prefill (pacote do contrato vai pelo grupo da noiva, visits.ts:73 proíbe `bridal` + `packageId`). Confirmar com o planner: com `prefill`, esconder "Pacote".
9. **Scroll do corpo**: o aviso de rolagem (`updateAtBottom`) depende de `packageId`; manter dependências.

## Code Examples

### Expansão no lugar (sketch)
```ts
// lib/visit-form.ts (nova função pura)
export function expandPackageAt<L extends { time: string; professionalId: string }>(
  lines: L[],
  index: number,
  expanded: VisitLine[],           // saída de expandPackageLines(pkg, startTime, profId)
  toLine: (l: VisitLine) => L,
): L[] {
  return [...lines.slice(0, index), ...expanded.map(toLine), ...lines.slice(index + 1)];
}
```
Chamada: `startTime = lines[index].time || lastFilledTimeAbove || '09:00'`.

### Grade do mês (sketch, local)
```ts
export function monthGrid(year: number, month: number): { iso: string; day: number; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay()); // domingo
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { iso, day: d.getDate(), inMonth: d.getMonth() === month };
  });
}
```

## State of the Art

| Antes | Agora | Impacto |
|-------|-------|---------|
| shadcn Calendar com react-day-picker v8 | react-day-picker 10.0.2 (latest; v9.14 ainda publicada) com date-fns 4 | só relevante se o planner escolher a lib |
| Pacote como campo global do modal | pacote por linha | esta fase |

## Open Questions

1. **Causa exata do "mesmo horário" no staging**
   - Sabido: sequência correta no código; backend não re-tempora.
   - Falta: reproduzir com os dados do staging (pacote, durações, hora de abertura).
   - Recomendação: tarefa 1 do plano = teste de reprodução (Q1); se passar, perguntar ao usuário em qual fluxo ocorreu (grupo da noiva? botão Novo? hora vazia?).
2. **Lixeira nas linhas do pacote**: manter habilitada ou só "Remover pacote"? Recomendo só "Remover pacote" (invariante simples); backend aceita subconjunto.
3. **Aba "Pacote" com `prefill`** (grupo da noiva): recomendo ocultar.

## Environment Availability

Fase só de código/config; sem dependência externa nova. Ferramentas locais: `node`, `corepack` (pnpm) já usados pelo projeto. Playwright (`apps/e2e`) exige o stack de e2e no ar (backend + Postgres); verificar antes de rodar e2e; fallback: validar apenas por vitest e print temporário de Playwright em staging.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.3 (jsdom ^25, @testing-library/react ^16, user-event ^14.6.8, MockedProvider do Apollo); Playwright em `apps/e2e` |
| Config file | `apps/frontend/vitest.config.ts` (globals, jsdom, `setupFiles: ./src/test-setup.ts`, alias `@`) |
| Quick run command | `cd /root/sgs/apps/frontend && npx vitest run src/features/operations/__tests__/visit-form.test.ts src/features/operations/__tests__/visit-form-package.test.tsx` |
| Dialog suite | `cd /root/sgs/apps/frontend && npx vitest run src/features/operations/__tests__ src/components/ui/__tests__` |
| Full suite | `corepack pnpm --filter @sgs/frontend test` (+ `typecheck`, `lint` do mesmo pacote: gate completo antes de commit) |

### Phase Requirements -> Test Map
| Decisão | Comportamento | Tipo | Comando | Arquivo existe? |
|---------|---------------|------|---------|-----------------|
| D-06/D-07 | pacote em linha com hora 10:00 gera 10:00/11:00/11:30; hora vazia usa fallback; sem cascata ao editar | unit + componente | `npx vitest run .../visit-form.test.ts` e `visit-form-package.test.tsx` | unit existe parcialmente; componente Wave 0 |
| D-02 | pacote no meio mantém avulsos acima e abaixo | unit (`expandPackageAt`) | idem | Wave 0 |
| D-03 | "Pacote" desabilitado nas outras linhas quando há pacote | componente | `visit-form-package.test.tsx` | Wave 0 |
| D-04 | "Remover pacote" tira só `fromPackage` e limpa `packageId`; avulsos intactos; payload do submit com `packageId` correto | unit + componente (mock de `CreateVisitMutation` inspecionando variáveis) | idem | Wave 0 |
| D-05 | mudar data/cliente invalida pacote e preserva avulsos | componente | idem | Wave 0 |
| D-01 | `#visit-package` não existe mais; seletor Serviço/Pacote por linha com alvo >= 44 px | componente | `novo-agendamento-gestor-beauty.test.tsx` (atualizar) | existe, atualizar |
| D-08 | digitação `dd/mm/aaaa` segue; clicar no ícone abre calendário; clicar no dia preenche o campo; semana começa domingo; pt-BR | componente | `src/components/ui/__tests__/date-field.test.tsx` | Wave 0 |
| D-08 | `monthGrid` (fevereiro bissexto, mês começando no domingo, 42 células, sem desvio de fuso) | unit | `month-grid.test.ts` | Wave 0 |
| D-08/UX-03 | no celular (390 px) o popover cabe e o modal full-screen segue | e2e visual | Playwright `zz-tmp-*.spec.ts` (temporário, não versionar) | Wave 0 (temporário) |
| Regressão | fluxo completo agendar com pacote/comanda | e2e | `apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts` | existe |

### Sampling Rate
- **Por commit de tarefa:** `npx vitest run` nos arquivos de operations tocados (< 30 s).
- **Por onda:** `corepack pnpm --filter @sgs/frontend test` + `typecheck` + `lint`.
- **Gate da fase:** suíte completa verde + print Playwright mobile/desktop do modal e do calendário antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/frontend/src/features/operations/__tests__/visit-form-package.test.tsx` — D-02..D-07 (reproduz o "mesmo horário")
- [ ] `apps/frontend/src/components/ui/__tests__/date-field.test.tsx` — D-08/D-09 (`components/ui/__tests__` já existe)
- [ ] casos novos em `visit-form.test.ts` para `expandPackageAt`/`removePackageLines`
- [ ] checar `ResizeObserver`/`scrollIntoView` em `src/test-setup.ts` para Radix Popover em jsdom
- Sem instalação de framework.

## Testes e e2e que tocam o que muda (Q4)

Vitest (`apps/frontend/src/features/operations/__tests__/`):
- `visit-form.test.ts` — `expandPackageLines` (linha 75) e `buildCreateVisitInput`; ampliar.
- `novo-agendamento-gestor-beauty.test.tsx` — layout do modal; asserção `visit-when` com `visit-date`/hora/duração (linhas 217-223) e posição do erro/Sinal; revisar se o select de pacote aparece em alguma asserção de ordem (grep por "package|pacote" nesses arquivos NÃO achou ocorrências: nenhum teste atual cobre o select de pacote).
- `visit-form-dialog.test.tsx`, `visit-form-prefill.test.tsx`, `visit-form-scroll.test.tsx`, `ux-agenda-lote1.test.tsx` — renderizam `VisitFormDialog`; rodar e ajustar (`key`, novos testids, prefill sem aba Pacote).
Playwright (`apps/e2e`): nenhum teste referencia `visit-package` nem `visit-date`. Usam o modal: `support/agenda-ui.ts` (profissional/sinal), `tests/fluxo-agendamento-comanda-pagamento.spec.ts`, `agenda-concorrencia.spec.ts`, `prioridade-profissionais.spec.ts`, `cronograma-noiva.spec.ts`, `assistente-papel.spec.ts`, `ux-agenda-celular.spec.ts`, `ux-contraste.spec.ts` (usam `visit-line-0-service`, `visit-line-N-professional`, `visit-deposit-*`): manter esses testids e a ordem das linhas. Novo e2e opcional: `agendamento-pacote-na-linha.spec.ts`.

## Mobile (Q5)
UX-03/UX-04 (fase 6): alvos >= 44 px (`min-h-[44px]`/`h-11 w-11` já usados no modal), modal `h-[100dvh]` full-screen abaixo de `sm`, aviso de rolagem (`updateAtBottom`). Seletor Serviço|Pacote: dois botões `min-h-[44px]` em largura total em celular; botão do calendário `h-11 w-11`; dias do calendário 44 px; popover limitado à viewport.

## Project Constraints (from CLAUDE.md)
- Frontend: React 19 (CLAUDE.md desatualizado: diz 18), Vite 6, Tailwind 3, shadcn/ui; Apollo Client 3.
- Não há prettier configurado: formatar à mão (aspas simples, ~100 colunas) apesar do script `format`.
- Acessibilidade WCAG 2.1 AA; testes obrigatórios; `/gsd:` para qualquer edição.
- Memória do projeto: nunca importar `tailwind.config.ts` em `src`; gate completo (typecheck, lint, vitest) antes de commit; deploy staging a partir de worktree limpo se houver trabalho alheio não commitado.

## Sources

### Primary (HIGH)
- Código lido: `VisitFormDialog.tsx`, `lib/visit-form.ts`, `lib/input-masks.ts`, `api/appointments.api.ts`, `SchedulePage.tsx:756,1334`, `backend/src/appointments/visits.ts`, `catalog/packages/packages.service.ts`, `tailwind.config.ts`, `vitest.config.ts`, `package.json`.
- `npm view react-day-picker` (2026-11-27): latest 10.0.2 (2026-09-30), deps `date-fns ^4.1.0`, `@date-fns/tz ^1.4.1`, peer react `>=16.8.0`; v9 até 9.14.0.

### Secondary/Tertiary
- Nenhuma. Hipótese de causa raiz = inferência por leitura de código (MEDIUM), a confirmar por teste.

## Metadata
**Confidence breakdown:**
- Stack/calendário: HIGH (versões verificadas; decisão de recomendação é julgamento)
- Arquitetura de estado: HIGH (código lido)
- Causa raiz do "mesmo horário": LOW-MEDIUM (não reproduzida)
- Pitfalls: MEDIUM-HIGH

**Research date:** 2026-11-27
**Valid until:** 2026-12-27
