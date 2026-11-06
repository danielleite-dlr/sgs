---
phase: 05-uso-no-dia-a-dia
plan: 14
subsystem: frontend-ux
tags: [ux, contratos, celular, cartões, contratante]
requires: [05-07, 05-08, 05-13]
provides: [UX-12, UX-13 corrigidos no staging]
key-files:
  created:
    - apps/frontend/src/features/bridal/components/CompleteContractorDialog.tsx
    - apps/frontend/src/features/bridal/lib/contractor-fields.ts
    - apps/frontend/src/features/bridal/__tests__/contract-detail-mobile.test.tsx
    - apps/frontend/src/features/bridal/__tests__/complete-contractor-dialog.test.tsx
    - apps/e2e/tests/ux-contrato-celular.spec.ts
    - apps/e2e/tests/ux-contrato-completar-dados.spec.ts
  modified:
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx
    - apps/frontend/src/features/bridal/components/ContractLinkCard.tsx
    - apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx
    - apps/e2e/support/phase4.ts
    - apps/e2e/tests/noivas-contrato.spec.ts
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
decisions:
  - "UX-12: Forma de pagamento, Itens por pessoa e Pagamentos têm tabela só a partir de md (hidden md:block) e cartões empilhados abaixo (md:hidden); todo valor em R$ com whitespace-nowrap"
  - "UX-12: no cartão Valores, a entrada pendente ganhou linha própria e os rótulos têm espaço até o valor (antes saía 'EntradaR$')"
  - "UX-12: o aviso de dados faltantes continua junto do botão 'Gerar link de aceite', que é o que ele bloqueia (gate D-09); não foi para perto do pagamento, que não depende desses dados"
  - "UX-13: um único 'Completar dados da contratante' abre um diálogo só com os campos que faltam (nome, CPF, endereço, celular 1 e 2, mesmas chaves CONTRACTOR_* do backend), salva com uma chamada a updateClient e atualiza contrato e pendências sem sair da tela; aparece só para quem tem client.write"
  - "Diálogo com useState e validação própria, como os outros diálogos de noivas (Reverse/Cancel), em vez de React Hook Form"
metrics:
  tasks: 3
  completed: 2026-11-06
---

# Phase 5 Plan 14: Noivas e contratos, lote 2 (UX-12, UX-13) Summary

No celular o contrato mostra forma de pagamento, itens por pessoa e pagamentos em cartões empilhados, e nenhum valor em R$ quebra em duas linhas. No computador as tabelas continuam como antes. Para completar os dados da contratante agora existe um único botão "Completar dados da contratante", que abre um diálogo só com o que falta (por exemplo CPF, endereço e Celular 2), valida o CPF e salva tudo de uma vez. A tela do contrato se atualiza sem sair dela.

## Commits

- ad27115: fix(05-14) correção do lote (UX-12, UX-13), com testes
- 51d13fd: docs(05-14) hash na auditoria
- commit final de docs: SUMMARY, STATE e ROADMAP

## Testes de regressão

- `contract-detail-mobile.test.tsx`: tabela em `hidden md:block` e cartões em `md:hidden` com os mesmos valores para itens, parcelas e pagamentos; valores em R$ com `whitespace-nowrap`; entrada pendente em linha própria; aviso de pendências imediatamente antes de "Gerar link de aceite". Falhavam antes.
- `complete-contractor-dialog.test.tsx`: só os campos que faltam; CPF inválido mostra "CPF inválido" e não salva; salvar chama `updateClient` uma vez com CPF sem máscara e celular formatado e fecha o diálogo.
- `contract-detail.test.tsx`: nenhum "Editar cliente" por item, um único botão "Completar dados da contratante", que abre o diálogo; sem `client.write` o botão não aparece.
- `ux-contrato-celular.spec.ts` (Playwright 412x915): cartões visíveis e tabelas escondidas; nenhum texto "R$ ..." fora das cláusulas ocupa mais de uma linha; sem rolagem horizontal. Pegou a quebra da entrada pendente no cartão Valores, corrigida neste lote.
- `ux-contrato-completar-dados.spec.ts`: contrato criado pela tela sem CPF, endereço e Celular 2; CPF inválido barrado; depois de salvar a URL continua `/contratos/<id>` e as três pendências somem.
- `noivas-contrato.spec.ts`: o passo que completava o Celular 2 pela ficha da cliente agora usa o diálogo.

## Gate

- typecheck e lint (-r): limpos
- Frontend: 78 arquivos, 515 testes. Backend unit: 367 de 367
- Backend integração: 599 de 601. As 2 falhas são só `phase4-alerts-boot.e2e.spec.ts` (Redis local NOAUTH, conhecida e aceita; o CI cobre)
- E2E completo: 37 de 37 (inclui os 2 specs novos)
- Deploy do staging concluído (`./scripts/deploy-staging.sh`, sem migration, sem backup necessário)
- CI na master: verde (run 42218717794 em 51d13fd, todos os jobs com sucesso)

## Deviations from Plan

1. **Aviso de dados faltantes não foi para perto do pagamento.** O plano pedia o aviso logo antes do bloco de pagamento. No backend esses dados bloqueiam só a geração do link de aceite (`generateLink`, gate D-09), não o pagamento. Movê-lo para o pagamento daria a entender que o pagamento está bloqueado. Ele ficou agrupado com o botão "Gerar link de aceite" (`contract-link-actions`), com teste que trava a ordem.
2. **Cartão Valores no celular (Regra 1, bug).** O E2E do celular mostrou "(pendente R$ 1.018,18)" quebrando em duas linhas e "EntradaR$" colado. A pendência ganhou linha própria e as linhas do cartão, espaço entre rótulo e valor.
3. **Diálogo sem React Hook Form.** O plano citava RHF + Zod "como os demais formulários"; os diálogos vizinhos de noivas usam estado simples, e foi esse o padrão seguido.

## Observações (fora do escopo aprovado)

- No celular o cabeçalho do contrato (`PageHeader`) põe quatro botões ao lado do título, que fica espremido em três linhas ("Contrato / CT-2027- / 001"). Não é item aprovado; fica como sugestão para a próxima auditoria.
