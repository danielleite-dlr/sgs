---
phase: 12-ajustar-cadastro-de-agendamento
verified: 2026-11-27T22:00:00Z
status: human_needed
score: 12/12 decisões verificadas no código (2 itens residuais para conferência humana)
human_verification:
  - test: "No staging, abrir Cadastrar agendamento, escolher Pacote 'Make & Penteado' numa linha com hora e conferir os horários"
    expected: "Serviços em sequência (ex.: 10:00 e 11:00), nunca na mesma hora"
    why_human: "D-12 parte B (UI no staging) não foi executada por falta de credencial de auditoria; o caso original não foi reproduzido, só coberto por teste de regressão"
  - test: "Abrir o calendário do campo Data no celular real e no desktop"
    expected: "Popover cabe na tela, semana começa no domingo, clicar no dia preenche dd/mm/aaaa e fecha"
    why_human: "Aparência e toque; só há prints do executor (o chip roxo sobre roxo do print computador-3 é captura em transição, código usa bg-primary text-white)"
---

# Phase 12: Ajustar cadastro de agendamento — Relatório de verificação

**Objetivo:** No modal "Cadastrar agendamento", o pacote é escolhido na própria linha de serviço (Serviço ou Pacote, um pacote por agendamento) e entra com os serviços em sequência; o campo Data ganha calendário clicável.
**Verificado:** 2026-11-27
**Status:** human_needed
**Re-verificação:** Não, verificação inicial

## Decisões D-01..D-12 contra o código

| Decisão | Status | Evidência |
| --- | --- | --- |
| D-01 select `#visit-package` sai; seletor Serviço/Pacote na linha | VERIFICADO | Nenhum `visit-package` como select no fim do modal; `KindToggle` (radiogroup "Serviço ou pacote", botões `min-h-[44px]`) em `VisitFormDialog.tsx` ~240-280; select de pacote por linha `visit-line-N-package` |
| D-02 pacote expande no lugar da linha, mantém as de cima e de baixo | VERIFICADO | `choosePackageAt` usa `expandPackageAt` (`visit-form.ts`), com hora/profissional da linha |
| D-03 um pacote por agendamento | VERIFICADO | `packageTaken` desabilita "Pacote" nas outras linhas; `buildCreateVisitInput` segue com um `packageId` |
| D-04 remover pacote tira só as linhas `fromPackage`, limpa `packageId` | VERIFICADO | `removePackage` + `removePackageLines` (devolve linha vazia se nada sobrar) |
| D-05 lista de pacotes inalterada; cliente/data inválida remove o pacote | VERIFICADO | `VisitPackagesQuery` por cliente e data; `useEffect` chama `removePackage()` quando `selectedPackage` some |
| D-06 sequência a partir da hora da linha | VERIFICADO | `expandPackageLines` com cursor + `addMinutes`; `packageStartTime` (linha, depois fim da linha de cima, depois 09:00); `safeMinutes` evita duração 0 |
| D-07 sequência só na escolha, sem cascata | VERIFICADO | `patchLine` altera só a linha; prefill usa ref `prefillSequencePending` (uma vez) |
| D-08 digitação + ícone abre mês em Popover, pt-BR, domingo primeiro, preenche dd/mm/aaaa | VERIFICADO | `components/ui/date-field.tsx` (máscara `maskDateBR`, botão "Abrir calendário", Popover, `WEEKDAY_INITIALS` começando em D, fecha ao escolher); usado em `VisitFormDialog.tsx` com `visit-date` e `visit-date-picker` |
| D-09 sem `<input type="date">`, sem dependência nova, reutilizável | VERIFICADO | Sem `type="date"`; `git diff` de `apps/frontend/package.json` vazio; `date-field.tsx` só importa de `@/components/ui` e `@/lib` |
| D-10 linhas do pacote com selo, serviço travado, sem lixeira, "Remover pacote" | VERIFICADO | Selo `do pacote {packageName}`; `disabled={line.fromPackage}` no serviço; lixeira só com `!line.fromPackage`; botão `visit-package-remove` na primeira linha do pacote; hora/duração/profissional continuam editáveis |
| D-11 prefill sem opção Pacote e com sequência | VERIFICADO | `allowPackage={!prefill}`; efeito do catálogo aplica `sequenceTimes` uma vez; teste `visit-form-prefill.test.tsx` |
| D-12 caso "Make & Penteado" | PARCIAL (aceitável) | Teste de regressão `visit-form-package.test.tsx` (10:00 e 11:00 com hora; 09:00 e 10:00 sem hora). Dados do staging conferidos (SELECT): 2 serviços de 60 min, sem duplicata; o bug não foi reproduzido. Parte B (UI no staging) não rodou por falta de credencial |

## Must-haves dos planos

- 12-01 (helpers puros): verificados em `visit-form.ts` (`expandPackageAt`, `removePackageLines`, `packageStartTime`, `sequenceTimes`, guarda de duração).
- 12-02 (DateField): verificado. Botão do calendário `h-11 w-11`; setas de mês usam `size="icon"` (= `h-11 w-11` em `button-variants.ts`); dias `h-11`. `lib/month-grid.ts` e `lib/date-br.ts` existem, com testes.
- 12-03 (pacote na linha): verificado, ver D-01..D-07, D-10.
- 12-04 (calendário no modal + prefill + gate): verificado no código; `visit-when` na mesma grade (Data 5, Hora 4, Duração 3 colunas em sm). Spec temporário `zz-tmp*` não existe em `apps/e2e`; E2E não referencia `visit-package` nem `visit-date`.

## Testes (alvo, rodados agora)

7 arquivos, 77 testes passando: `date-field.test.tsx`, `month-grid.test.ts`, `visit-form.test.ts`, `visit-form-package.test.tsx`, `visit-form-prefill.test.tsx`, `visit-form-dialog.test.tsx`, `novo-agendamento-gestor-beauty.test.tsx`. Os avisos de `act(...)` do Radix são ruído, não falha. A suíte completa fica com o orquestrador.

## Anti-padrões

Nenhum blocker. Sem TODO/placeholder nos arquivos da fase. Observação leve: o `useEffect` do D-05 chama `removePackage` sem listá-lo nas dependências (padrão já usado no arquivo; sem efeito funcional visível).

## Prints (executor)

Conferi `12-celular-3-pacote.png`: selo "do pacote", serviço travado, "Remover pacote" e dois chips de serviço visíveis. Os outros cinco prints não foram reabertos.

## Resumo

Todas as decisões estão implementadas e ligadas ao envio. As pendências são humanas: confirmar no staging o caso "Make & Penteado" com a UI real (D-12 parte B) e conferir o calendário no celular real.

---

_Verificado: 2026-11-27_
_Verificador: Claude (gsd-verifier)_
