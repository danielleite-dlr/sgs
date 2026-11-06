# Phase 6: Novo layout Gestor Beauty - Context

**Gathered:** 2026-11-06
**Status:** Ready for planning
**Source:** decisões da usuária na conversa de 2026-11-06 + projeto Stitch "Gestor Beauty"

<domain>
## Phase Boundary

O SGS troca de cara para o design do projeto Stitch **"Gestor Beauty"** (`projects/5888991241990799272`), sistema de design **"Studio Editorial Density"**. A fase muda só o visual, a navegação e a organização das telas, usando os dados que o SGS já tem. Nenhuma regra de negócio, consulta GraphQL, migration ou permissão muda.

Entregas em lotes, cada um com deploy no staging e CI verde, para a usuária ver a mudança aos poucos:
1. **Lote base**: tokens (cores, fontes, raio, sombras, espaçamento), componentes compartilhados (botão, campo, select, badge, card, tabela, diálogo, folha, abas) e o casco (menu lateral, topo, barra inferior do celular, PageHeader). Depois dele o sistema inteiro já muda de cara.
2. **Um lote por tela**, nesta ordem: Agenda do dia → Novo agendamento → Comanda → Entradas e saídas (Financeiro) → Previsão de caixa → Despesas fixas → Grupo de noivas → Início.
3. **Fechamento**: conferência no staging e aceite da usuária.

</domain>

<decisions>
## Implementation Decisions

### Escopo (travado pela usuária em 2026-11-06)
- D-01: **Só o visual.** Estilo, navegação e organização das telas, com os dados que já existem.
- D-02: O que aparece no design e o SGS não tem fica **fora** e vai para o backlog (999.7): bancadas/cadeiras/salas, meta de faturamento, "Exportar DRE", ocupação das bancadas em tempo real, cerimonial/assessoria, status de prova, "Sincronizado", seletor de unidade ("Atelier Jardins • Matriz"), relógio "10:42 BRT", contagem "x clientes" por profissional se não existir dado pronto. Onde o design mostra um desses blocos, o lote o omite (não cria placeholder vazio nem dado falso).
- D-03: **Ordem**: lote base primeiro, depois uma tela por lote, na ordem da seção acima.

### Sistema visual (fonte: `design/DESIGN.md`)
- D-04: Fundo de página `#F7F6F3`; superfícies (cartões, linhas de tabela, diálogos, folhas, menu lateral, topo) `#FFFFFF` com borda de 1 px `#E2DFE5`.
- D-05: Texto principal `#221E26`; texto secundário `#6B6670`.
- D-06: Roxo da marca `#570080` só na ação principal, no item de menu selecionado, na aba/filtro selecionado e no foco. Texto sobre ele sempre `#FFFFFF`. Hover da ação principal `#440064`.
- D-07: Fontes: **Source Serif 4 (600)** em títulos de página (h1), títulos de seção e **nomes de cliente**; **Public Sans (400/500/600)** em todo o resto. Números (horários, valores, contagens, códigos) com `font-variant-numeric: tabular-nums`. Inter sai.
- D-08: Raio **6 px** em botões, campos, cartões, diálogos, menus, badges e blocos da agenda. Sem pílulas (`rounded-full` só em avatar e ponto de status).
- D-09: **Sem sombras difusas.** Separação por borda de 1 px. Fundo de diálogo `rgba(34, 30, 38, 0.40)`. Sem gradiente, sem glassmorphism/blur (inclusive na barra inferior e no topo).
- D-10: **Alvos de 44 px**: botões, campos, itens de menu, itens da barra inferior, abas e chips interativos com altura mínima de 44 px (chip visual pode ter 28–36 px dentro de área de toque de 44 px).
- D-11: **Status com borda esquerda de 3 px** na cor do status, superfície branca (sem fundo colorido): Agendado `#570080`, Confirmado `#1B7A43`, Em atendimento `#0E61A8`, Concluído `#49454F`, Faltou/Cancelado `#BA1A1A`. Selo de status: fundo `#F7F6F3`, borda 1 px `#E2DFE5`, ponto de 6 px na cor, texto 11–12 px 600.
- D-12: Cores semânticas: sucesso/entrada `#1B7A43`, erro/saída `#BA1A1A` (substituem `#1D9E75` e `#D85A30`); alerta mantém o âmbar `#EF9F27` em ícone/borda, com texto escuro (contraste AA).
- D-13: Rótulos de campo acima do campo, 11–12 px, 600, maiúsculas com espaçamento 0.04em, cor `#6B6670`. Maiúsculas só em rótulos curtos e cabeçalhos de tabela; nunca em nomes de cliente, serviços ou frases.
- D-14: Foco: borda `1.5px #570080` sem halo nos campos; nos demais elementos o anel de foco visível continua (WCAG 2.1 AA).

### Navegação
- D-15: **Computador**: menu lateral branco de 256 px com borda à direita, cabeçalho com a marca do estúdio, grupos com rótulo em maiúsculas pequenas e itens de 44 px; item ativo em roxo cheio com texto branco. A árvore de menu continua a do SGS (`menu-config.ts`) com seus submenus e permissões; só o visual muda. No rodapé do menu, usuário logado e sair.
- D-16: **Topo (computador)**: branco, borda inferior, data do dia por extenso em Public Sans tabular, busca "Buscar páginas no SGS", sino de notificações e avatar. Sem seletor de unidade, relógio ou "Sincronizado" (D-02).
- D-17: **Celular**: topo com marca do estúdio e data; barra inferior branca com borda superior, 5 itens de 48 px com rótulo: **Agenda, Comanda, Clientes, Noivas, Mais**, como no design. Cada item respeita a permissão atual do usuário (sem permissão, o item não aparece e os demais se redistribuem). "Mais" abre a gaveta com a árvore completa, onde ficam Início e Notificações. O sino continua no topo.
- D-18: Ícones: continua **lucide-react** (já no projeto). Não adicionar Material Symbols; escolher o ícone lucide equivalente.

### Telas (cada lote segue o HTML/screenshot de referência da tela)
- D-19: Agenda do dia (celular): seletor de profissional em botões de 44 px com avatar e nome, botão "Filtros" com texto, linha do tempo com horas na margem e linhas finas (cheia na hora cheia, tracejada na meia hora), blocos com borda de status, nome em serifa, serviço, horário "09:00 - 10:30 • 90 min", indicador roxo da hora atual, bloqueio em hachura. Computador: colunas por profissional com cabeçalho em serifa. Textos do design que não existem no SGS ("Preparação de bancada", "Cadeira 01") não entram (D-02).
- D-20: Novo agendamento: folha no celular / diálogo no computador com rótulos em maiúsculas, chips de serviço, controle segmentado de profissional, grade Data/Hora/Duração, erro de conflito escrito embaixo da linha, seção "Sinal" recolhida, ação principal no rodapé.
- D-21: Demais telas (Comanda, Entradas e saídas, Previsão de caixa, Despesas fixas, Grupo de noivas, Início) seguem as respectivas telas do projeto Stitch, sempre com D-02.
- D-22: As correções de usabilidade da fase 5 (UX-01 a UX-19) não podem regredir: texto branco sobre roxo, alvos de 44 px, cartões no celular, valores em R$ sem quebra, nomes com `toDisplayName`, tipos em português, filtros juntos etc. Os testes de regressão da fase 5 continuam valendo.

### Testes e entrega
- D-23: Cada lote: testes Vitest das classes/estrutura alteradas, E2E existentes verdes (ajustar só seletor que dependia de estilo; `data-testid` e papéis ARIA se mantêm), gate completo, commit, push, deploy no staging e CI verde (fluxo padrão do projeto).
- D-24: Cada lote compara a tela com a referência do Stitch usando o roteiro de screenshots `apps/e2e/audit` contra o ambiente local (`AUDIT_TARGET=local`, com seed do E2E). A conta de auditoria do staging continua desativada; a conferência no staging é feita pela usuária no fechamento.
- D-25: O rodapé institucional da Agenda ("Meu site | SGS Ajuda | Blog | Fale conosco | Contato" + ícones de redes sociais, `SchedulePage.tsx`, comentário "Footer institucional (estilo Trinks)") sai — decisão da usuária em 2026-11-06 ("tira"). Não existe no design e os links apontam para `#`.

### Claude's Discretion
- Como mapear os tokens no Tailwind (manter os nomes atuais `primary-*`, `neutral-*`, `text-label/body/heading/display` e trocar os valores, ou criar nomes novos), desde que nenhum componente fique com cor antiga.
- Divisão do lote base em mais de um plano (tokens/componentes e casco), desde que vão juntos ao staging.
- Ícone lucide equivalente para cada Material Symbol.
- Tamanhos exatos de tipografia dentro da escala do DESIGN.md.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design
- `.planning/phases/06-novo-layout-gestor-beauty/design/DESIGN.md` — sistema de design "Studio Editorial Density" (tokens, regras, componentes)
- `.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md` — contrato visual da fase (mapeamento dos tokens para o SGS)
- `.planning/phases/06-novo-layout-gestor-beauty/design/*.html` — HTML das telas do Stitch (Tailwind CDN; referência de estrutura e classes, não para copiar o CDN)
- `.planning/phases/06-novo-layout-gestor-beauty/design/*.png` — screenshots das telas
- Telas que ainda não estão em `design/`: baixar pelo MCP do Stitch (`mcp__stitch__download_file` com o `name` abaixo) no início do lote da tela e salvar em `design/`

| Tela | Screen (projects/5888991241990799272/screens/…) |
|------|------|
| Agenda do dia (celular) | 845719aac8a8444884e393e48644ded0 (em design/) |
| Agenda do dia multi-profissional (computador) | 6e515928b7ed4e6ab4e502ec268d71a6 (em design/) |
| Novo agendamento (celular) | e940967ef5b64f81a360c2b0221ec9f7 (em design/) |
| Novo agendamento (computador) | 146f645a9e0a4f46a2e8ac2c1ce13229 (em design/) |
| Comanda C-2026-014 (computador) | 4f842ca8578c4861849f5e9fc789dcac |
| Comanda C-2026-014 (celular) | 69b81c7989b94f3db4ef6fd602feccda |
| Entradas e saídas (computador) | 635a7a9431b54dec984a81feaaef574d |
| Entradas e saídas (celular) | a45672503a584a4aa089e9cb6ff53a5a |
| Previsão de caixa (computador) | ae25b7da5de744d9833ca6f96e18073e |
| Previsão de caixa (celular) | 06cb522750a54dad8ae969770aa03f6f |
| Despesas fixas (computador) | 3a05c509377a41b3ab728925631a9170 |
| Grupo de noivas (computador) | c5f9c23d170f4baab46aba264eb8a5fb |
| Grupo de noivas (celular) | 3694705c2ace43c3a65a548680e0fae1 |
| Dashboard operacional (computador) | 6a49551034c84556a83fb1e0ede496b1 (em design/) |
| Dashboard operacional (celular) | 02f87860a3144a2ab1bcfef64de96b8e |

### Código atual (pontos de entrada)
- `apps/frontend/tailwind.config.ts` — tokens atuais (Inter, cores #570080/#FAFAF8/#E5E3DC/#888780/#2C2C2A, raio 4/8/12, sombra card)
- `apps/frontend/src/styles/globals.css` — variáveis CSS e foco
- `apps/frontend/index.html` — carregamento de fontes
- `apps/frontend/src/components/ui/*` — componentes shadcn (button-variants, badge-variants, input, select, card, table, dialog, sheet, tabs, data-table)
- `apps/frontend/src/components/layout/*` — AppShell, SidebarNav, IconRail, TopHeader, BottomNav, AppDrawer, PageHeader, menu-config
- `.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md` — itens UX-01 a UX-19 que não podem regredir
- `apps/e2e/audit/` — roteiro de auditoria somente leitura com screenshots

</canonical_refs>

<specifics>
## Specific Ideas

- Referência de sensação: "agenda de papel de maquiadora" com densidade tipo Linear (briefing de layout publicado em 2026-11-06).
- Dados de exemplo do design (Mariana Albuquerque, Cadeira 01 etc.) são só ilustração; as telas mostram os dados reais do SGS.

</specifics>

<deferred>
## Deferred Ideas

- Backlog 999.7 (funções vistas no design, não aprovadas): bancadas/cadeiras/salas e ocupação em tempo real; meta de faturamento e % da meta; exportar DRE diário; cerimonial/assessoria e "dossiê" da noiva; status de prova; ações rápidas "Iniciar"/"Check-in" no painel; comparação "vs semana anterior"; multiunidade.
- Observações da fase 5: título do grupo de noivas sem `toDisplayName` ("Noiva julia Souza") e tabela "Itens por pessoa" apertada no contrato no computador — podem ser resolvidas dentro dos lotes de Grupo de noivas e do lote base se cair naturalmente na tela, sem virar escopo extra.

</deferred>

---

*Phase: 06-novo-layout-gestor-beauty*
*Context gathered: 2026-11-06*
