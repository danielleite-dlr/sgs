# Fase 6: conferência do novo layout (Gestor Beauty)

Roteiro para a conferência no staging e registro do aceite. A conta de auditoria do staging continua
desativada (D-24): quem confere é a usuária, com o próprio acesso.

## Resumo

O sistema inteiro ganhou a cara do Gestor Beauty: fundo claro, roxo `#521873` nos botões principais
(sempre com letra branca), títulos em letra serifada e valores em reais alinhados e sem quebrar linha.
No computador há um menu lateral branco com o nome do salão no alto e, embaixo, o nome de quem entrou.
No celular o menu vira uma barra de baixo com Agenda, Comanda, Clientes, Noivas e Mais.
Só mudou o visual: os dados e as regras são os mesmos de antes.

## Roteiro no staging

Endereço base: https://sgs.jessicaseixasmakeup.com.br. Quem entra como administradora da plataforma
precisa abrir o "Studio JS" pelo painel de clientes para ver as telas do salão.

| Tela | Endereço | O que conferir | Celular e computador |
|------|----------|----------------|----------------------|
| Menu e topo (qualquer tela) | qualquer página | Menu lateral branco, item atual em roxo com letra branca; topo com a data por extenso, busca, sino e avatar | Computador: menu à esquerda. Celular: barra de baixo com Agenda, Comanda, Clientes, Noivas e Mais |
| Agenda do dia | `https://sgs.jessicaseixasmakeup.com.br/agenda` | Botão "Agendar" roxo com letra branca; "Dia" e "Semana" com o escolhido em roxo; colunas por profissional com o nome em letra serifada; horas à esquerda | Celular: trocar de profissional com os botões de nome e avatar; "Filtros" com texto |
| Novo agendamento | Agenda, botão "Agendar" | Cliente, serviços em botões com preço, profissional escolhido em roxo, data/hora/duração, sinal recolhido; "Salvar" roxo | Celular: o formulário ocupa a tela inteira |
| Comanda | `/comanda`, abrir uma | Cliente, itens com valor à direita, pagamento com Total, Pago e Falta; "Fechar comanda" roxo e aviso do que falta | Celular: uma coluna só, na ordem Cliente, Itens, Adicionar, Pagamento |
| Entradas e saídas | `/financeiro` | Números do período, filtros de período com o escolhido em roxo, gráfico Faturado/Recebido, lançamentos com valores verdes (entrada) e laranja (saída) | Celular: lançamentos em cartões |
| Previsão de caixa | `/financeiro/previsao` | "7 dias, 15 dias, 30 dias" com o escolhido em roxo; Entradas, Saídas e Saldo previstos; saídas por grupo; semanas com tabela | Celular: a tabela da semana rola para o lado |
| Despesas fixas | `/financeiro/despesas-fixas` | Total mensal em laranja; tabela com Ativa/Inativa em selo; "Nova despesa fixa" | Celular: tabela rola para o lado |
| Grupo de noivas | `/noivas`, abrir um grupo | Ficha do evento, integrantes com nome em letra serifada, abas Pessoas, Agenda do evento e Cronograma do dia; "Criar contrato" roxo | Celular: a página não rola para o lado; tabela de integrantes rola dentro da caixa |
| Início | `/dashboard` | Faixa com atendimentos, faturado, noivas e ticket médio do dia; próximos atendimentos; comandas em aberto; previsão de caixa com gráfico em verde e laranja | Celular: números em linhas, uma por assunto |

Conferir em todas: letra branca sobre roxo, botões fáceis de tocar, nomes de cliente em letra normal
(não tudo maiúsculo), valores em R$ sem quebrar linha.

## O que ficou de fora (só existe no design)

Isto não é defeito: o design mostra, o sistema ainda não tem o dado ou a função. Tudo está no backlog
999.7 do ROADMAP.

- Casco: versão "SGS Atelier" e cadeado no menu; relógio, "Sistema operacional/Online" e nome da unidade no topo; seletor de unidade.
- Agenda: bancadas, cadeiras e salas; ocupação em tempo real; lista de espera e bloqueio técnico; selo de verificado e especialidade da profissional; rótulo "Agora"; "Horário livre" e "Preparação de bancada"; valor no bloco do atendimento.
- Novo agendamento: selo Noiva/VIP do cliente; "(Ativa)" no profissional; comprovante, "Recebido em" e "Pago" no sinal; aviso de conflito antes de salvar.
- Comanda: botão WhatsApp; observações, histórico rápido e pontualidade; NF-e; Quitada/Pendente; atalho de teclado; transferir bancada; conciliação e autorização de pagamento; comprovantes e recibo por WhatsApp; protocolo de fechamento; situação contábil; terminal e operador.
- Entradas e saídas: exportar diário; lançar manualmente; chips só entradas/só saídas; busca e filtro por forma; painel "Estado do Sistema"; "Previsão D+7", cartões a compensar e auditoria fiscal; "Fechamento provisório"; "Conciliação em dia".
- Previsão de caixa: total e % do desembolso por grupo; selo "Semana corrente"; busca por atalho.
- Despesas fixas: categorias, centro de custo, fornecedor e anexos; recorrência que não seja mensal; "pago no mês"; exportar e meta.
- Grupo de noivas: coluna profissional e valor por pessoa; assessoria e local da produção; plano financeiro, envio e checklist do contrato; notas da diretora criativa e código do contrato no cabeçalho; cerimonial e dossiê da noiva.
- Início: "Filtrar período", "Sincronizado" no topo, barras de meta, ocupação das bancadas, exportar DRE diário.

## Auditoria local (preparação do roteiro)

Rodada `AUDIT_TARGET=local` em 2026-11-16, 37 testes verdes (setup + 18 telas no computador + 18 no
celular). Evidência em `06-audit-evidence/06-11/` (ignorada pelo git).

- Erros de console (incluindo HTML inválido, UX-10): nenhum nas 36 telas.
- Palavras sem acento e palavras em inglês: nenhuma.
- Rolagem lateral da página: nenhuma, em nenhuma tela.
- Regressão entre lotes: nenhuma encontrada nas capturas de Agenda, Comanda, Entradas e saídas, Previsão e Início (computador e celular). Casco, tokens, selos e botões roxos com letra branca coerentes entre os lotes.
- Alvos de toque menores que 44 px no celular, os mesmos já vistos nos lotes anteriores (nenhum novo): link da marca no topo (40 px), links da trilha (16 px), filtro Ativos/Concluídos/Cancelados em Noivas (29 px), cartão do dia na semana da Agenda (26 px), código da comanda e nome na lista (17 a 20 px). O rodapé "Meu site/Blog..." e as redes sociais que apareciam no 06-02 já não existem.
- Observação: nas capturas de página inteira do celular a barra de baixo aparece no meio da imagem; é efeito da ferramenta de captura, não do layout.
- Observação: a tabela de "Início" no 06-10-SUMMARY dizia que KPIs, próximos atendimentos, comandas e contratos de noivas não apareciam, mas a auditoria mostra que eles aparecem (vêm do quick 261107-in8). O backlog 999.7 foi corrigido para listar só o que realmente falta.

## Aceite

- **Data:** 2026-11-16
- **Forma:** resposta na conversa, depois de receber o resumo e a tabela "Roteiro no staging"
- **Resposta da usuária:** "aprovado"
- **Ajustes pedidos:** nenhum. As omissões do design seguem no backlog 999.7; os alvos de toque menores que 44 px já conhecidos (marca, trilha, filtro de Noivas, cartão do dia na semana, código e nome na lista de comandas) continuam como observação, sem pedido de correção.
- **Staging conferido:** build `index-D7kMf1cp.js` (deploy de 2026-11-15), que contém todos os lotes 06-01 a 06-10 e 06-12; os commits seguintes só alteraram testes e documentação.
