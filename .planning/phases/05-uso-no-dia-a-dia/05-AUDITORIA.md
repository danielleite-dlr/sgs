---
phase: 05-uso-no-dia-a-dia
status: aprovada
audited_at: 2026-11-05
ambientes: staging (somente leitura, usuário de auditoria) e local semeado (fluxos com escrita)
---

# Auditoria de usabilidade — Fase 5

## Resumo para a usuária

Percorri as telas principais no celular (Pixel 7) e no computador (1366x768), na ordem Agenda, Comanda e caixa, Noivas e contratos, Clientes e financeiro, Painel. No staging só olhei (nada foi gravado); as tarefas com escrita foram cronometradas no ambiente de teste local. Boas notícias: nenhuma tela estoura a largura, não há palavra sem acento visível e as tarefas do dia a dia levam poucos cliques (marcar horário 3, fechar comanda e receber 7, achar cliente 1). Os problemas que mais atrapalham:

1. **UX-01** — Botões e abas "ligados" (Dia/Semana, filtros de período, Salvar) têm letra escura sobre roxo e quase não dá para ler.
2. **UX-06** — O botão "Fechar comanda" parece desativado (lilás pálido) mesmo quando já está tudo pago.
3. **UX-11** — O texto do contrato mostra asteriscos soltos (`**`) no meio das cláusulas.
4. **UX-12** — Contratos no celular: tabelas espremidas e valores quebrando em duas linhas.
5. **UX-13** — Para completar os dados que faltam no contrato, cada item manda abrir a ficha da cliente, um por vez.
6. **UX-15** — Na lista de clientes nada indica que a linha é clicável; no celular a coluna "Ações" fica cortada.
7. **UX-17** — O Financeiro mostra "contract_in" (código interno em inglês) na coluna Tipo.
8. **UX-07** — A lista de comandas ocupa uma faixa estreita e o código da comanda quebra em três linhas.
9. **UX-02** — No celular vários botões ficam menores que o dedo (cerca de 20 por tela na Agenda).
10. **UX-20** — O painel inicial hoje cai direto na Agenda; proponho uma previsão do dia (só com sua aprovação).

## Como aprovar

Preencha a coluna "Aprovado?" de cada item com **sim**, **não** ou **depois**. Também vale responder em texto (ex.: "aprovo todos os Bloqueia e Atrapalha; UX-07 depois"). Só os itens com **sim** viram correção.

## Itens por tela

Severidade: **Bloqueia** (impede a tarefa), **Atrapalha** (atrasa ou confunde), **Polimento** (acabamento). Esforço: **P** (< 1 h), **M** (1–3 h), **G** (> 3 h).

Nesta rodada nenhum item chegou a **Bloqueia**: todas as tarefas medidas foram concluídas.

### 1. Agenda

| ID | Severidade | Tela | Passo a passo | Esperado x Observado | Correção proposta | Esforço | Evidência | Aprovado? |
|----|------------|------|---------------|----------------------|-------------------|---------|-----------|-----------|
| UX-01 | Atrapalha | Agenda e demais telas com botão/aba selecionado | Abrir a Agenda; olhar "Dia"/"Semana"; abrir "Agendar" e olhar "Salvar"; repetir nos filtros de Comandas e Financeiro | Esperado: letra clara sobre fundo roxo. Observado: letra escura sobre roxo, quase ilegível | Corrigir a cor do texto dos botões primários e das abas/filtros selecionados (provável token de cor invertido) | P | desktop/01-agenda-dia.png; mobile/02-agenda-semana.png; desktop/03-agenda-novo-agendamento.png | sim |
| UX-02 | Atrapalha | Agenda no celular | Abrir a Agenda no celular e tentar tocar o botão de filtros e os avatares de profissionais | Esperado: alvos de toque de pelo menos 44 px. Observado: botão de filtros é só um ícone minúsculo e há cerca de 20 alvos menores que 44 px; na visão da semana as iniciais dos avatares ficam cortadas e repetidas | Aumentar a área de toque, trocar o ícone por "Filtros" com texto e mostrar nome curto nos avatares | M | mobile/01-agenda-dia.png; mobile/02-agenda-semana.png | sim |
| UX-03 | Atrapalha | Novo agendamento no celular | Tocar em "Agendar"; descer o formulário | Esperado: ver Hora, Duração e "Adicionar serviço" sem procurar. Observado: o corpo do diálogo rola por dentro e esses campos ficam escondidos abaixo da dobra; o rodapé com Salvar fica fixo | Dar mais altura ao corpo do diálogo no celular e mostrar uma sugestão de rolagem | M | mobile/03-agenda-novo-agendamento.png | sim |
| UX-04 | Polimento | Novo agendamento | Abrir o diálogo "Cadastrar agendamento" | Esperado: um botão de fechar. Observado: dois "X" (um grande no canto, outro pequeno no título) | Manter só um | P | desktop/03-agenda-novo-agendamento.png | sim |
| UX-05 | Polimento | Agenda (desktop) | Olhar o calendário lateral e o canto superior direito | Observado: "Novembro De 2026" com "De" em maiúscula; o selo "Pgto Indica" fica em duas linhas minúsculas e some no celular | Escrever "Novembro de 2026"; dar nome e tamanho legíveis ao selo ou removê-lo se não for usado | P | desktop/01-agenda-dia.png | sim |

### 2. Comanda e caixa

| ID | Severidade | Tela | Passo a passo | Esperado x Observado | Correção proposta | Esforço | Evidência | Aprovado? |
|----|------------|------|---------------|----------------------|-------------------|---------|-----------|-----------|
| UX-06 | Atrapalha | Detalhe da comanda | Adicionar itens e pagamentos até "Falta R$ 0,00"; olhar "Fechar comanda" | Esperado: botão forte, pronto para fechar. Observado: botão lilás pálido, com cara de desativado, mesmo já podendo fechar (o clique funciona) | Dar ao botão pronto a cor cheia e explicar o motivo quando estiver realmente desativado | P | desktop/w-fechar-comanda-e-rec.png; desktop/06-comanda-detalhe.png | sim |
| UX-07 | Atrapalha | Lista de comandas | Abrir Comandas | Esperado: tabela usando a largura da tela. Observado: tabela estreita (cerca de 400 px de 1300) com o código "C-2026-001" quebrando em três linhas, "Aberta em" em duas e nome do cliente todo em maiúsculas | Tabela em largura total, sem quebra no código e nome em caixa normal | M | desktop/05-comanda-lista.png | sim |
| UX-08 | Atrapalha | Detalhe da comanda | Abrir uma comanda | Esperado: cartão "Cliente" começa pelo nome. Observado: primeira linha é o código da comanda (repetido do título) e o telefone aparece sem formatação (+55119...) | Remover a linha do código e formatar o telefone como (11) 98888-7777 | P | desktop/06-comanda-detalhe.png | sim |
| UX-09 | Polimento | Detalhe da comanda no celular | Abrir uma comanda no celular | Observado: "Itens da comanda" fica depois de "Adicionar à comanda" e o nome do item quebra em três linhas | Mostrar itens logo abaixo do cliente e dar mais largura ao nome | M | mobile/06-comanda-detalhe.png | sim |
| UX-10 | Polimento | Menu lateral (todas as telas) | Abrir qualquer tela e olhar o console | Observado: aviso técnico de HTML inválido (item de lista dentro de item de lista) no menu, em toda página | Corrigir a estrutura do menu | P | metrics-desktop.jsonl (erros de console) | sim |

### 3. Noivas e contratos

| ID | Severidade | Tela | Passo a passo | Esperado x Observado | Correção proposta | Esforço | Evidência | Aprovado? |
|----|------------|------|---------------|----------------------|-------------------|---------|-----------|-----------|
| UX-11 | Atrapalha | Detalhe do contrato | Abrir um contrato e rolar até "Texto do contrato" | Esperado: cláusulas limpas e títulos em destaque. Observado: asteriscos literais (`**I. Das partes:**`, `**Contratado:**`) no meio do texto | Interpretar o negrito do texto na tela (e conferir o PDF) | M | desktop/12-contrato-detalhe.png | sim |
| UX-12 | Atrapalha | Detalhe do contrato no celular | Abrir um contrato no celular | Esperado: tabelas legíveis. Observado: "Itens por pessoa" e "Forma de pagamento" espremidas, valores (R$ 1.018,18) quebram em duas linhas e o aviso de dados faltantes fica longe do botão de pagamento | Trocar tabelas por cartões empilhados no celular | M | mobile/12-contrato-detalhe.png | sim |
| UX-13 | Atrapalha | Detalhe do contrato | Ler "dados do contrato que faltam" (CPF, endereço, celulares) | Esperado: completar tudo de uma vez. Observado: cada dado faltante tem seu "Editar cliente", que abre a ficha da cliente; são vários idas e vindas | Um único "Completar dados da contratante" em diálogo, sem sair do contrato | G | mobile/12-contrato-detalhe.png | sim |
| UX-14 | Polimento | Detalhe do grupo de noivas | Abrir um grupo | Observado: "Status: Ativo [Rascunho]" mostra dois estados lado a lado sem explicação; "Pronta até" aparece só com "—"; telefone sem formatação | Um único status com legenda curta; esconder campo vazio ou convidar a preencher; formatar o telefone | P | desktop/10-noivas-detalhe.png | sim |

Medido: criar grupo, contrato e registrar a primeira parcela levou 6 cliques (ver medição abaixo).

### 4. Clientes e financeiro

| ID | Severidade | Tela | Passo a passo | Esperado x Observado | Correção proposta | Esforço | Evidência | Aprovado? |
|----|------------|------|---------------|----------------------|-------------------|---------|-----------|-----------|
| UX-15 | Atrapalha | Lista de clientes | Abrir Clientes e tentar abrir uma ficha | Esperado: nome com cara de link. Observado: o nome não é link nem muda ao passar o mouse; só clicando na linha abre a ficha. No celular a coluna "Ações" aparece cortada ("Aç") e E-mail/CPF vazios ocupam espaço | Transformar o nome em link, mostrar mão/realce na linha, esconder colunas vazias e usar cartões no celular | M | desktop/13-clientes-lista.png; mobile/13-clientes-lista.png | sim |
| UX-16 | Atrapalha | Lista de clientes | Procurar cliente de nome repetido | Observado: o mesmo cliente aparece três vezes (mesmo telefone) e a caixa das letras varia (MAIÚSCULAS e minúsculas) | Avisar duplicidade ao cadastrar (mesmo telefone) e exibir nomes com caixa padronizada | M | desktop/13-clientes-lista.png | sim (parcial) |
| UX-17 | Atrapalha | Financeiro, tabela "Lançamentos" | Abrir Financeiro e olhar a coluna Tipo | Esperado: "Entrada de contrato". Observado: "contract_in" (código interno em inglês) | Traduzir os tipos de lançamento para português | P | desktop/07-financeiro.png | sim |
| UX-18 | Atrapalha | Financeiro, cartões do topo | Olhar "Faturado", "Recebido", "Comandas fechadas" e "Ticket médio" | Esperado: números que se explicam. Observado: Faturado R$ 800 e Recebido R$ 900 ao lado de "Comandas fechadas 0" e ticket R$ 0,00; só uma frase miúda explica que o faturado vem de contratos | Explicar na própria tela por que Recebido difere de Faturado (sinais) e separar contratos de comandas | M | desktop/07-financeiro.png | sim |
| UX-19 | Polimento | Clientes e Financeiro | Olhar os botões "Ações" e filtros | Observado: botão de ações é só "..." minúsculo; filtros de período e de agrupamento (Dia/Semana/Mês) ficam longe um do outro | Ícone maior com rótulo acessível; juntar os filtros | P | desktop/13-clientes-lista.png; desktop/07-financeiro.png | sim |

Acentuação: a varredura do código (`nao`, `voce`, `servico` etc.) só achou chaves de tradução e rotas; nenhum texto visível sem acento nas 16 telas, nos dois tamanhos.

### 5. Painel (propostas — D-08; nada entra no painel além da previsão sem aprovação)

| ID | Severidade | Tela | Passo a passo | Esperado x Observado | Correção proposta | Esforço | Evidência | Aprovado? |
|----|------------|------|---------------|----------------------|-------------------|---------|-----------|-----------|
| UX-20 | Atrapalha | Painel inicial | Abrir "Início" (/dashboard) | Esperado: visão do dia. Observado: redireciona para a Agenda, sem resumo | Previsão do dia: agendamentos de hoje e amanhã, valores a receber no dia e parcelas de contrato que vencem | G | desktop/16-painel.png | depois |

## Medição das tarefas frequentes (D-03)

| Tarefa | Ambiente | Dispositivo | Cliques | Tempo | Observações |
|--------|----------|-------------|---------|-------|-------------|
| Marcar horário (até salvar) | local semeado | desktop | 3 | cerca de 1,4 s de automação | Clicar no horário, escolher cliente da lista, Salvar; serviço e profissional por seletores (sem clique extra contado) |
| Marcar horário (até salvar) | local semeado | celular | 3 | cerca de 2,2 s de automação | Igual ao desktop; o formulário rola por dentro (UX-03) |
| Marcar horário (até antes de salvar) | staging, somente leitura | desktop e celular | 1 | cerca de 1,5 s para abrir o formulário | Não foi salvo nada |
| Remarcar | local semeado | desktop | 1 | cerca de 1,3 s | Um gesto de arrastar; no celular o teste automático não alcançou a agenda (usa o menu do computador), então remarcar no celular fica **a verificar** com a usuária |
| Fechar comanda e receber | local semeado | desktop | 7 | cerca de 3,5 s | Abrir card, abrir comanda, adicionar produto, Pix, dinheiro, fechar |
| Registrar parcela | local semeado | desktop | 6 | cerca de 5,2 s | Inclui criar grupo e contrato; parcela registrada pelo diálogo (staging: diálogo aberto com 1 clique e parado antes de confirmar) |
| Achar cliente | local semeado | desktop | 1 | cerca de 3,5 s | Buscar e clicar na linha; no staging a busca respondeu em 0,6 s no desktop e 0,07 s no celular |

Nos fluxos do celular só a marcação de horário foi cronometrada; os demais ficaram sem medida por limitação do roteiro automático.

## Ideias de funcionalidade nova (fora da correção — vão para o backlog)

- Painel com resumo do dia e alerta de parcelas de contrato vencendo.
- Aviso de cliente duplicado (mesmo telefone) ao cadastrar.
- Remarcar pelo menu do cartão do agendamento (alternativa ao arrastar, útil no celular).
- Completar dados da contratante direto no contrato.

## Registro de aprovação

- **Data:** 2026-11-06
- **Forma:** resposta em texto na conversa. Resposta literal da usuária: "aprovo tudo, UX-20 depois, UX-16 só padronizar nomes".
- **Aprovados (sim):** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12, UX-13, UX-14, UX-15, UX-17, UX-18, UX-19.
- **Aprovado em parte (sim, parcial):** UX-16 — só padronizar a caixa dos nomes de cliente exibidos (ex.: "Maria Silva" em todo lugar). O aviso de cadastro duplicado (mesmo telefone) NÃO foi aprovado e vai para o backlog como funcionalidade nova.
- **Depois (backlog):** UX-20 (painel com resumo do dia). O painel já ganha a previsão de 30 dias nesta fase pelos planos 05-06 e 05-06b.
- **Não:** nenhum item.
- **Pendente de conferência manual da usuária (não é item de correção):** remarcar agendamento no celular — a auditoria automática não alcançou a agenda no celular; a usuária confere no celular e avisa se algo atrapalhar (vira item novo no aceite final do 05-20).

## Correções

| ID | Lote (plano) | Corrigido em (commit) | Verificado no staging |
|----|--------------|-----------------------|-----------------------|
| UX-01 | 05-09 | 3de395d | 2026-11-06 (staging, somente leitura) |
| UX-04 | 05-09 | 3de395d | 2026-11-06 (staging, somente leitura) |
| UX-05 | 05-09 | 3de395d | 2026-11-06 (staging, somente leitura) |
| UX-02 | 05-10 | acdc9e4 | 2026-11-06 (staging, somente leitura) |
| UX-03 | 05-10 | acdc9e4 | 2026-11-06 (staging, somente leitura) |
| UX-06 | 05-11 | dff8996 | 2026-11-06 (staging, somente leitura) |
| UX-07 | 05-11 | dff8996 | 2026-11-06 (staging, somente leitura) |
| UX-08 | 05-11 | dff8996 | 2026-11-06 (staging, somente leitura) |
| UX-09 | 05-12 | — | — |
| UX-10 | 05-12 | — | — |
| UX-11 | 05-13 | — | — |
| UX-14 | 05-13 | — | — |
| UX-12 | 05-14 | — | — |
| UX-13 | 05-14 | — | — |
| UX-15 | 05-15 | — | — |
| UX-16 | 05-15 | — | — |
| UX-17 | 05-16 | — | — |
| UX-18 | 05-16 | — | — |
| UX-19 | 05-16 | — | — |

### Para depois (backlog)

- UX-20 — Painel inicial com resumo do dia (agendamentos de hoje e amanhã, valores a receber, parcelas vencendo). Backlog 999.6.
- UX-16 (parte não aprovada) — Aviso de cliente duplicado (mesmo telefone) ao cadastrar. Backlog 999.6.
- Remarcar pelo menu do cartão do agendamento (alternativa ao arrastar, útil no celular). Backlog 999.6, a decidir depois da conferência manual no celular.
