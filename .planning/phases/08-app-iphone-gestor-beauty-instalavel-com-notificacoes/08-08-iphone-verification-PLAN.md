---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 08
type: execute
wave: 5
depends_on: ["08-07"]
files_modified:
  - .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md
autonomous: false
requirements: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11]

must_haves:
  truths:
    - "A usuária vê 'Instalar no iPhone' no login pelo Safari, segue o passo a passo e o Gestor Beauty aparece na Tela de Início com o ícone GB roxo e abre em tela cheia (D-01, D-02)"
    - "Dentro do app instalado, depois de entrar de novo, 'Ativar notificações' pede a permissão do iOS e a faixa mostra 'Notificações ativadas' (D-05)"
    - "Um agendamento criado por outra conta gera notificação no iPhone com o app em segundo plano e fechado; o texto é o mesmo do Android (D-04, D-08)"
    - "Tocar na notificação abre a agenda no dia do atendimento, inclusive com o app fechado (D-04)"
    - "Depois de sair (logout), um novo agendamento não chega mais no iPhone (D-06)"
    - "O app Android continua recebendo os avisos como antes (D-07)"
  artifacts:
    - path: ".planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md"
      provides: "Manual-Only Verifications com resultado por linha"
      contains: "Manual-Only Verifications"
  key_links:
    - from: "iPhone da usuária"
      to: "device_tokens (provider webpush)"
      via: "Ativar notificações → registerDeviceToken"
      pattern: "webpush"
---

<objective>
Verificação no iPhone real da usuária de tudo que não dá para automatizar: instalação pela Tela de Início, permissão de notificação, entrega pela Apple, toque abrindo a agenda e logout parando os avisos.

Purpose: aceite final da fase 8 (o Playwright não cobre permissão real, entrega da Apple nem modo standalone do iOS). Problemas viram gaps (`/gsd:plan-phase 8 --gaps`), sem conserto especulativo aqui.
Output: `08-VALIDATION.md` com o resultado de cada verificação manual.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-07-SUMMARY.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-13-device-verification-play-PLAN.md

Staging: `https://sgs.jessicaseixasmakeup.com.br`. Postgres: `sgs_stg_postgres` (credenciais do `.env.staging`, carregado linha a linha). Nunca imprimir a chave VAPID privada.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Preparar o teste (conferência do servidor e roteiro no VALIDATION)</name>
  <files>.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md</files>
  <read_first>
    - .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md (Manual-Only Verifications)
    - .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-07-SUMMARY.md
  </read_first>
  <action>
1. Conferir no staging: `docker logs sgs_stg_backend 2>&1 | grep -c "Web Push habilitado"` ≥ 1; `./scripts/check-pwa-headers.sh https://sgs.jessicaseixasmakeup.com.br` verde; contagem inicial `select provider, count(*) from device_tokens group by provider` (anotar no SUMMARY).
2. Em `08-VALIDATION.md`, seção "Manual-Only Verifications": trocar a linha única por uma tabela com coluna `Resultado` (`⬜` em cada linha) e as linhas:
   - "Botão 'Instalar no iPhone' no login (Safari) e passo a passo" (D-01)
   - "Aviso 'Abra no Safari' em outro navegador do iPhone (se houver Chrome instalado)" (D-01)
   - "Ícone GB roxo e nome 'Gestor Beauty' na Tela de Início; abre em tela cheia, sem barra do Safari" (D-02)
   - "App instalado pede login de novo (esperado) e o login funciona" (D-01)
   - "Faixa 'Ativar notificações' → permissão do iOS → 'Notificações ativadas'" (D-05)
   - "Novo agendamento chega com o app em segundo plano e fechado" (D-04, D-08)
   - "Cancelamento chega" (D-08)
   - "Toque abre a agenda no dia do atendimento (app fechado)" (D-04)
   - "Depois de sair, novo agendamento não chega" (D-06)
   - "Android continua recebendo (se houver aparelho Android à mão)" (D-07)
   - "Versão do iOS do aparelho" (anotar; abaixo de 16.4 a faixa deve mostrar 'atualize o iOS')
3. Commit `docs(08-08): roteiro de verificação no iPhone`.
  </action>
  <verify>
    <automated>cd /root/sgs && grep -n "Resultado" .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md && docker logs sgs_stg_backend 2>&1 | grep -q "Web Push habilitado"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Toque abre a agenda no dia" .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md` encontra
    - `grep -n "Depois de sair" .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md` encontra
    - logs do backend no staging com "Web Push habilitado"
  </acceptance_criteria>
  <done>Servidor conferido e roteiro pronto para a usuária.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Teste no iPhone real</name>
  <files>.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md</files>
  <read_first>
    - .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md
  </read_first>
  <what-built>Gestor Beauty instalável no iPhone pela Tela de Início (sem App Store), com notificações de agendamento por Web Push, toque abrindo a agenda e logout parando os avisos.</what-built>
  <how-to-verify>
Apresentar à usuária, em pt-BR. Precisa de: o iPhone (iOS 16.4 ou mais novo; ver em Ajustes → Geral → Sobre → Versão do iOS) e um computador ou outro celular logado como gestora para criar agendamentos.

**Instalação**
1. No iPhone, abra o **Safari** e entre em https://sgs.jessicaseixasmakeup.com.br. Na tela de login, toque em **Instalar no iPhone** e confira o passo a passo.
2. Toque em **Compartilhar** (quadrado com seta para cima) → role → **Adicionar à Tela de Início** → **Adicionar**. Confira o ícone **GB roxo** e o nome **Gestor Beauty**.
3. (Se tiver Chrome no iPhone) abra o mesmo endereço no Chrome e toque em Instalar no iPhone: deve aparecer o aviso para abrir no Safari.

**Dentro do app**
4. Abra pelo ícone novo. Ele abre em tela cheia (sem a barra do Safari) e pede login **de novo** — isso é esperado. Entre com seu usuário de sempre.
5. No topo aparece **Receba os avisos da agenda** → toque em **Ativar notificações** → o iPhone pergunta → **Permitir**. Deve aparecer "Notificações ativadas neste iPhone."
6. Volte para a tela de início do iPhone (app em segundo plano). No computador, crie um agendamento para você (ou para a profissional logada no iPhone). Em alguns segundos chega a notificação **Novo agendamento**.
7. Feche o app (arraste para cima na lista de apps). Crie outro agendamento: a notificação chega. **Toque nela**: o app abre na **agenda do dia** com o atendimento.
8. Cancele um agendamento pelo computador: chega **Agendamento cancelado**.
9. No app, **saia** (menu da usuária → Sair). Crie mais um agendamento pelo computador: **não deve chegar** notificação no iPhone.
10. (Se tiver o celular Android com o app) confira que ele continua recebendo os avisos.

Anote OK ou o problema de cada item (número + o que aconteceu) e a versão do iOS.
  </how-to-verify>
  <resume-signal>Responda "aprovado" ou liste os itens com problema (número + o que aconteceu), e diga a versão do iOS do aparelho.</resume-signal>
  <action>Depois da resposta: conferir no staging `select provider, platform, count(*) from device_tokens group by 1,2` (deve ter aparecido `webpush|ios` no passo 5 e sumido depois do passo 9 se era o único aparelho dela); preencher a coluna `Resultado` de cada linha do `08-VALIDATION.md` com `✅` ou `❌ <resumo>`; se tudo verde, frontmatter `status: approved`. Itens com problema viram gaps para `/gsd:plan-phase 8 --gaps` (sem conserto especulativo neste plano). Registrar a resposta e a versão do iOS no SUMMARY. Commit `docs(08-08): verificação no iPhone`.</action>
  <verify>
    <automated>sed -n '/Manual-Only Verifications/,/Validation Sign-Off/p' /root/sgs/.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md | grep -c "⬜" | grep -x 0</automated>
  </verify>
  <acceptance_criteria>
    - nenhuma linha da seção manual com `⬜` (comando do `<verify>` sai 0)
    - resposta da usuária e versão do iOS registradas no SUMMARY
    - contagem de `device_tokens` por provider antes/depois registrada no SUMMARY
  </acceptance_criteria>
  <done>Cada verificação no iPhone tem resultado; gaps listados para /gsd:plan-phase 8 --gaps.</done>
</task>

</tasks>

<verification>
Aprovação (ou gaps) da usuária registrada linha a linha no VALIDATION.md, com a versão do iOS.
</verification>

<success_criteria>
A equipe instala o Gestor Beauty no iPhone sem App Store e recebe as mesmas notificações do Android, confirmado no aparelho real (objetivo da fase).
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-08-SUMMARY.md`
</output>
