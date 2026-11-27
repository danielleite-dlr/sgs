---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 24
gap_closure: true
status: complete
---

# 11-24 — Gate, backup, deploy e CI dos gaps G-01/G-02

## Gate local (26/11)
- typecheck e lint de todos os pacotes: limpos
- backend unit: 73 suítes / 876 testes
- backend integração (`--runInBand --forceExit`; sem `--forceExit` o jest fica pendurado no fim neste ambiente): 108 suítes / 1051 testes
- frontend vitest: 169 arquivos / 1213 testes
- codegen dos documentos do frontend contra `apps/backend/src/graphql/schema/**/*.graphql` (config temporária, saída no scratchpad): ok — o `codegen` do pacote aponta para um servidor no ar e grava `src/gql`, por isso não foi usado
- `@sgs/shared` test: ok
- E2E Playwright: 86/86 (14,1 min)
- Verificações estáticas do plano: as 5 vazias (migração sem UPDATE em members nem permissões; convite sem ASSISTANT; time-blocks intocado; grade sem filtro; abas sem `defaultValue="people"`)

## Staging
- Backup antes do deploy: `/root/sgs-backups/stg-pre-assistente-20261126-2249.sql.gz` (333 KB, 58 tabelas)
- `deploy-staging.sh` da árvore limpa: migração `20261126200000_phase11_assistant_role` aplicada, backend e frontend OK
- Conferências somente leitura: migração finalizada (1 linha); `roles` ASSISTANT de sistema = 1; permissões do ASSISTANT = 0; contagem por papel na Studio JS igual antes/depois (ADMIN 5, ATTENDANT 1, MANAGER 2, PROFESSIONAL 15 — ninguém virou Assistente); `/login` 200; log do backend sem erro de schema

## CI
Lido depois do último push (ver commit seguinte).

## Próximo
Retomar a verificação humana 11-16 com a seção "Reverificação dos gaps" do 11-VALIDATION.md.
