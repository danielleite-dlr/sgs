---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 13
type: execute
wave: 7
depends_on: ["07-12"]
files_modified:
  - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md
autonomous: false
requirements: [C-01, C-02, C-03, C-04, C-05]

must_haves:
  truths:
    - "A usuária instala o Gestor Beauty no celular, vê o ícone GB roxo e o nome 'Gestor Beauty', a splash papel, entra e continua logada depois de fechar e abrir (D-03, D-16, D-17, D-18)"
    - "Novo agendamento e cancelamento chegam como push com o app em primeiro plano, em segundo plano e fechado; a profissional só recebe os dela, gestoras recebem todos, e quem fez a ação não recebe (D-11, D-12, D-13)"
    - "Agendar o lote de noivas gera um aviso-resumo por profissional e um para a gestora (D-15)"
    - "Tocar no aviso abre a agenda no dia com o atendimento aberto, inclusive com o app fechado e com a sessão vencida (D-14)"
    - "Modo avião mostra 'Sem conexão' com 'Tentar novamente' (D-08)"
    - "Botão voltar, teclado, entalhe e barra de status se comportam bem; PDF de contrato foi testado (se quebrar, vira gap)"
    - "Se a conta Play já foi aprovada, o AAB está no teste interno e uma pessoa convidada instalou pela loja (D-09)"
  artifacts:
    - path: ".planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md"
      provides: "Manual-Only Verifications com aprovado/problema por linha; nyquist_compliant"
      contains: "Manual-Only Verifications"
  key_links:
    - from: "APK assinado (07-12)"
      to: "aparelho da usuária"
      via: "adb install ou teste interno da Play"
      pattern: "adb install"
---

<objective>
Verificação humana no aparelho real de tudo que não dá para automatizar nesta fase, e a primeira publicação no teste interno da Play Console se a conta já estiver aprovada.

Purpose: fechar C-01..C-05 com a usuária; problemas viram gaps (`/gsd:plan-phase 7 --gaps`), sem conserto especulativo (decisão do orquestrador nº 4 para PDF/download).
Output: VALIDATION.md com o resultado de cada verificação manual.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md
@apps/mobile/KEYSTORE.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-12-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Preparar o teste (APK assinado, conferência do push no servidor, roteiro)</name>
  <files>.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md</files>
  <read_first>
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md (Manual-Only Verifications)
    - apps/mobile/KEYSTORE.md (seção "Teste antes da conta Play")
  </read_first>
  <action>
1. Localizar o APK assinado mais recente: `ls -t /root/gestor-beauty-apks/release-*/*.apk | head -1` (se não houver, `gh workflow run android.yml --ref master` e baixar como no 07-12).
2. Conferir no staging: `docker logs sgs_stg_backend 2>&1 | grep -c "Push FCM habilitado"` ≥ 1 e `docker exec -e PGPASSWORD=... sgs_stg_postgres psql ... -Atc "select count(*) from device_tokens"` (antes do teste, provavelmente 0).
3. Na seção "Manual-Only Verifications" do `07-VALIDATION.md`, acrescentar uma coluna `Resultado` com `⬜` em cada linha e as linhas extras: "Lote de noivas → 1 aviso por profissional + 1 para a gestora (D-15)", "Sessão vencida → toque abre a agenda depois do login", "Admin de plataforma dentro do salão não recebe push", "PDF de contrato / exportação abre no app (Pitfall 9)".
  </action>
  <verify>
    <automated>cd /root/sgs && ls -t /root/gestor-beauty-apks/release-*/*.apk | head -1 && grep -n "Resultado" .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - existe um `.apk` em `/root/gestor-beauty-apks/release-*/`
    - `grep -n "Lote de noivas" .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md` encontra a linha
    - `docker logs sgs_stg_backend 2>&1 | grep "Push FCM habilitado"` encontra a linha
  </acceptance_criteria>
  <done>APK e roteiro prontos para a usuária.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Teste no aparelho (e teste interno da Play, se a conta já foi aprovada)</name>
  <files>.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md</files>
  <read_first>
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md
  </read_first>
  <what-built>App Android "Gestor Beauty" (casca Capacitor carregando o staging), push de novo agendamento e cancelamento, toque que abre a agenda, tela "Sem conexão", ícone e splash.</what-built>
  <how-to-verify>
Apresentar à usuária, em pt-BR. Ideal: dois celulares Android (um com Android 13 ou mais novo), um logado como **profissional** e outro como **gestora (admin/gerente)**.

**Instalação** (escolher um caminho)
- **Pela Play (se a conta já foi aprovada):** Play Console → Criar app "Gestor Beauty" (idioma Português (Brasil), app, gratuito) → Testar e lançar → **Teste interno** → Criar versão → enviar o arquivo `.aab` que eu passar → aceitar a **Assinatura de apps do Google Play** → em Testadores, criar a lista com os e-mails da equipe (até 100) → abrir o link de convite no celular e instalar pela loja.
- **Pelo arquivo (enquanto a conta não existe):** eu passo o `.apk`. No celular, Configurações → Sobre o telefone → tocar 7 vezes em "Número da versão" → Opções do desenvolvedor → ligar "Depuração USB"; ligar o celular no computador e rodar `adb install -r gestor-beauty.apk`. (Desde 30/09/2026 o Android pode bloquear a instalação direta pelo arquivo no Brasil; o `adb install` é o caminho mais garantido.)

**Roteiro** (anote OK ou o problema em cada item)
1. Ícone "GB" roxo e nome "Gestor Beauty" na tela inicial; ao abrir, tela clara (papel) com o ícone, que some quando o sistema carrega.
2. Entre com seu usuário de sempre. O celular pergunta se pode mandar notificações → **Permitir**. Feche o app (arrastando da lista) e abra de novo: continua logada.
3. No computador (ou no celular da gestora), crie um agendamento para a profissional do outro celular. Teste com o app da profissional: **aberto** (aparece um aviso no topo da tela), **em segundo plano** e **fechado** (notificação do sistema). A gestora também recebe; **quem criou não recebe**.
4. Cancele um agendamento: chega "Agendamento cancelado" para a profissional e para a gestora (menos para quem cancelou).
5. Num grupo de noivas, agende o evento com vários atendimentos da mesma profissional: ela recebe **um** aviso do tipo "3 atendimentos no casamento da …, dd/mm"; a gestora recebe **um** resumo.
6. Com o app fechado, toque na notificação: abre a **agenda no dia** do atendimento, com ele aberto. Repita depois de sair da conta (logout): toque, faça login, e confira que vai direto para o atendimento.
7. Ligue o **modo avião** e abra o app: aparece "Sem conexão" e "Tentar novamente". Desligue o modo avião e toque em "Tentar novamente": o sistema volta. Ligue o modo avião com o app aberto: a mesma tela aparece; ao reconectar, ela some.
8. Botão **voltar** do Android: fecha janelas abertas, volta de tela, e na tela inicial sai do app. Preencha um formulário (ex.: nova cliente): o teclado não esconde o campo. Cabeçalho não fica embaixo da câmera/entalhe; barra de baixo não fica embaixo da barra de gestos.
9. Abra um **contrato** e tente ver/baixar o **PDF**; tente uma exportação do financeiro. Anote se abriu ou não (se não abrir, fica registrado para corrigir depois).
10. (Se der) Entre como admin da plataforma no salão pelo painel: esse aparelho **não** deve receber avisos do salão.
  </how-to-verify>
  <resume-signal>Responda "aprovado" ou liste os itens com problema (número + o que aconteceu). Diga também se a conta Play foi aprovada e se o teste interno foi publicado.</resume-signal>
  <action>Depois da resposta: preencher a coluna `Resultado` de cada linha do `07-VALIDATION.md` com `✅` ou `❌ <resumo do problema>`; se tudo automatizado e manual estiver verde, marcar `nyquist_compliant: true` e `status: approved` no frontmatter. Itens com problema viram gaps para `/gsd:plan-phase 7 --gaps` (sem conserto especulativo neste plano; PDF/download que falhar é gap). Se a conta Play ainda não foi aprovada, marcar a linha "Teste interno na Play Console" como `⏳ aguardando conta` e registrar no SUMMARY que a publicação no teste interno fica pendente só disso. Commit `docs(07-13): verificação no aparelho`.</action>
  <acceptance_criteria>
    - `grep -n "Manual-Only Verifications" .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md` encontra a seção
    - nenhuma linha da seção manual com `⬜` restante (`sed -n '/Manual-Only Verifications/,/Validation Sign-Off/p' .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md | grep -c "⬜"` = 0)
    - resposta da usuária registrada no SUMMARY (aprovado ou lista de gaps)
  </acceptance_criteria>
  <verify>
    <automated>sed -n '/Manual-Only Verifications/,/Validation Sign-Off/p' /root/sgs/.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md | grep -c "⬜" | grep -x 0</automated>
  </verify>
  <done>Cada verificação manual tem resultado registrado; gaps listados para /gsd:plan-phase 7 --gaps.</done>
</task>

</tasks>

<verification>
Aprovação (ou gaps listados) da usuária registrada linha a linha no VALIDATION.md; estado da conta Play e do teste interno registrado.
</verification>

<success_criteria>
A equipe usa o Gestor Beauty no celular com as mesmas telas do web e recebe push de novo agendamento e cancelamento (objetivo da fase), confirmado no aparelho real.
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-13-SUMMARY.md`
</output>
