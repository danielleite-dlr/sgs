# Phase 6 — UI Design Contract

**Fonte:** `design/DESIGN.md` (Stitch "Studio Editorial Density"), decisões D-04 a D-18 de `06-CONTEXT.md`.
**Status:** aprovado pela usuária (escolheu o projeto Gestor Beauty e "só o visual" em 2026-11-06).

## 1. Cores

| Papel | Valor | Uso |
|-------|-------|-----|
| Fundo da página | `#F7F6F3` | `body`, área de conteúdo, cabeçalhos de coluna da agenda |
| Superfície | `#FFFFFF` | cartões, linhas, diálogos, folhas, menu lateral, topo, barra inferior |
| Superfície baixa | `#F4F3F0` | cabeçalho de tabela, campo somente leitura, bloco recolhido |
| Linha | `#E2DFE5` | toda borda e divisor (1 px) |
| Texto | `#221E26` | texto principal |
| Texto secundário | `#6B6670` | rótulos, metadados, cabeçalhos de coluna, inativo |
| Marca | `#570080` (hover `#440064`) | ação principal, item ativo, aba/filtro selecionado, foco, hora atual |
| Marca clara | `#F5E6FB` | avatar de iniciais, realce discreto |
| Sucesso / entrada | `#1B7A43` | valores positivos, Confirmado |
| Erro / saída | `#BA1A1A` (fundo `#FFDAD6`, texto `#93000A`) | valores negativos, erros, Faltou/Cancelado |
| Informação | `#0E61A8` | Em atendimento |
| Concluído | `#49454F` | Concluído |
| Alerta | `#EF9F27` (texto `#8A5300`) | estoque baixo, "em atraso" |

Texto sobre `#570080` é sempre `#FFFFFF`. Nenhum gradiente, blur ou transparência decorativa.

## 2. Tipografia

| Token | Família | Tamanho / linha | Peso | Uso |
|-------|---------|-----------------|------|-----|
| display | Source Serif 4 | 28/36 (celular) · 36/44 (≥ lg) | 600 | número de destaque do Início |
| headline-lg | Source Serif 4 | 26/32 | 600 | h1 de página |
| headline-md | Source Serif 4 | 20/28 | 600 | título de seção / cartão |
| headline-sm | Source Serif 4 | 17/24 | 600 | nome de cliente em bloco/cartão, título de folha |
| body-lg | Public Sans | 15/22 | 400 | texto corrido |
| body-md | Public Sans | 13–14/18–20 | 400/500 | tabela, menu, campos |
| body-sm | Public Sans | 12/16 | 400 | metadados |
| label | Public Sans | 11–12/16, 0.04em, MAIÚSCULAS | 600 | rótulo de campo, cabeçalho de tabela, grupo de menu |
| data | Public Sans tabular | 13/18 | 500 | horários, valores, códigos |

Fontes carregadas por `<link>` no `index.html` (Google Fonts, `display=swap`): Source Serif 4 (600) e Public Sans (400, 500, 600). Inter deixa de ser carregada. Mínimo de 12 px para texto de leitura; 10–11 px só em rótulo curto em maiúsculas.

## 3. Forma e espaço

- Raio único 6 px (`rounded-md`); avatar e ponto de status redondos; sem pílulas.
- Sem `box-shadow` (inclusive `shadow-card`, dropdown, popover, toast, diálogo); borda de 1 px `#E2DFE5`.
- Escala de espaço mantém xs 4 · sm 8 · md 16 · lg 24 · xl 32 · 2xl 48 · 3xl 64; densidade: padding interno de cartões e linhas 8–12 px.
- Alvo mínimo 44 × 44 px para tudo que é tocável.

## 4. Componentes

| Componente | Especificação |
|------------|---------------|
| Botão primário | fundo `#570080`, texto branco 13–14 px 600, altura 44, padding 0 20, raio 6, hover `#440064` |
| Botão secundário (outline) | fundo branco, texto `#221E26`, borda `#E2DFE5`, altura 44; hover fundo `#F7F6F3` e borda `#6B6670` |
| Botão fantasma | transparente, texto `#6B6670`, altura 44; hover texto `#221E26` e fundo `#F7F6F3` |
| Botão destrutivo | fundo `#BA1A1A`, texto branco |
| Campo / select / textarea | altura 44, fundo branco, borda `#E2DFE5`, raio 6, padding 0 14, texto 13–14 px, placeholder `#6B6670`; foco borda 1.5 px `#570080` sem halo |
| Rótulo | acima do campo, regra "label" da tipografia |
| Badge / selo | fundo `#F7F6F3`, borda `#E2DFE5`, raio 6, altura 24–28, texto 11–12 px 600; variante de status com ponto de 6 px |
| Cartão | fundo branco, borda `#E2DFE5`, raio 6, sem sombra |
| Tabela | cabeçalho fundo `#F4F3F0`, texto label `#6B6670`; linhas brancas com divisor `#E2DFE5`; números tabulares e alinhados à direita |
| Diálogo | branco, borda, raio 6 (máx. 8), sem sombra; fundo `rgba(34,30,38,0.40)`; título headline-md em serifa; fechar 44 px |
| Folha (sheet) | mesma regra do diálogo; no celular sobe de baixo com raio superior |
| Abas / filtro segmentado | itens de 44 px; ativo `#570080` com texto branco |
| Bloco de agendamento | branco, borda 1 px e borda esquerda 3 px na cor do status, padding 10 × 14, nome em serifa 15–17 px, metadados 12 px tabular `#6B6670` |
| Toast | branco, borda, sem sombra, texto `#221E26` |

## 5. Casco

- **Menu lateral (≥ lg)**: 256 px, branco, borda direita; topo com marca do estúdio (quadrado roxo com iniciais + nome em serifa); grupos com rótulo label; itens 44 px com ícone lucide 20 px; ativo roxo cheio + texto branco; rodapé com usuário e sair. Submenus da árvore atual mantidos (recuo e mesmo visual).
- **Topo (≥ lg)**: 56 px, branco, borda inferior; data por extenso; busca; sino; avatar.
- **Celular**: topo 56–64 px branco com marca + data; barra inferior branca com borda superior, 5 itens (Agenda, Comanda, Clientes, Noivas, Mais) de 48 px com ícone e rótulo; ativo em `#570080`. Itens filtrados por permissão; "Mais" abre a gaveta com a árvore completa (Início e Notificações incluídos).
- **PageHeader**: trilha em label pequeno, h1 em serifa headline-lg, ações à direita (no celular quebram para baixo do título em vez de espremer o título).

## 6. Proibições

Gradiente, glassmorphism/blur, sombra difusa, ícone em círculo colorido, pílula, KPIs em cards gigantes, emoji, saudação com nome, texto escuro sobre roxo, nome de cliente em maiúsculas, código interno em inglês, dados inventados para preencher blocos do design que o SGS não tem.
