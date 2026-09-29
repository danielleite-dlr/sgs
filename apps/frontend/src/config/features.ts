/**
 * Feature flags — o que está mockado fica desligado.
 *
 * Toda tela cujo conteúdo hoje vem de `mocks/` (ou de dados escritos à mão no
 * componente) está desligada aqui. Nada foi apagado: o código das telas segue
 * no repositório e volta a aparecer assim que a flag correspondente virar
 * `true` — o que deve acontecer no mesmo commit que liga o backend real dela.
 *
 * Consumidores:
 *   - `router.tsx`       → não registra a rota (cai no 404)
 *   - `menu-config.ts`   → poda o item do menu (e o grupo, se ficar vazio)
 *   - `BottomNav`, `TopHeader`, `AppShell` → escondem os controles decorativos
 *
 * A ordem de religamento está em `.planning/ROADMAP-MOCKS.md`.
 */
const FLAGS = {
  /** Home com cards de descoberta — conteúdo estático. */
  dashboard: false,
  /** Agenda em modo relatório (`?modo=relatorio`) — o parâmetro não é lido. */
  agendaRelatorio: false,
  /** Filtro de aniversariantes (`?filtro=aniversariantes`) — não é lido. */
  clientesAniversariantes: false,
  /** Rankings (clientes, serviços, produtos, profissionais) — sem tela. */
  rankings: false,
  /** Gestão de equipe: `/profissionais` — lista, convite, edição e desativação reais. */
  equipe: true,
  /** Comanda / PDV — `mocks/comanda.mock.ts`. */
  comanda: false,
  /** Controle de entrada e saída — números fixos em R$ 0,00. */
  financeiro: false,
  /** Comissões calculadas — `mocks/financeiro.mock.ts`. */
  financeiroComissoes: false,
  /** As 10 sub-páginas de relatório financeiro — layout sem consulta. */
  financeiroRelatorios: false,
  /** Central de relatórios — catálogo de cards sem destino. */
  relatorios: false,
  /** Configurações — lista de links; nenhum destino existe. */
  configuracoes: false,
  /** Grupos de noivas — `mocks/bridal.mock.ts`. */
  noivas: false,
  /** Contratos de evento — `mocks/bridal.mock.ts`. */
  contratos: false,
  /** Campanhas de comunicação — `mocks/communication.mock.ts`. */
  campanhas: false,
  /** Painel de notificações (sino) — backend existe, painel não. */
  notificacoes: false,
  /** Bolha de chat de suporte — UI sem envio. */
  chatSuporte: false,
  /** Seletor de estabelecimento — nome do salão hardcoded no header. */
  estabelecimentoSelector: false,
  /** Régua de assinatura / plano — não há cobrança no produto. */
  assinatura: false,
  /** Ajuda e tutoriais no header — botões decorativos. */
  ajudaTutoriais: false,
} as const;

export type FeatureKey = keyof typeof FLAGS;

/** Tipado como boolean de propósito: virar uma flag não muda tipo nenhum. */
export const FEATURES: Record<FeatureKey, boolean> = FLAGS;

/** Para onde mandar o usuário quando a home ainda não existe. */
export const HOME_PATH: string = FEATURES.dashboard ? '/dashboard' : '/agenda';

/**
 * Caminhos governados por flag, do mais específico para o mais genérico.
 * A primeira entrada que casar decide; caminho fora da lista está liberado.
 */
const GATED_PATHS: ReadonlyArray<readonly [string, FeatureKey]> = [
  ['/agenda?modo=relatorio', 'agendaRelatorio'],
  ['/clientes?filtro=aniversariantes', 'clientesAniversariantes'],
  ['/clientes/ranking', 'rankings'],
  ['/catalogo/servicos/ranking', 'rankings'],
  ['/catalogo/produtos/ranking', 'rankings'],
  ['/profissionais/ranking', 'rankings'],
  ['/profissionais/perfis', 'configuracoes'],
  ['/profissionais', 'equipe'],
  ['/comanda', 'comanda'],
  ['/financeiro/comissoes', 'financeiroComissoes'],
  ['/financeiro/caixa', 'financeiroRelatorios'],
  ['/financeiro/pagamento-profissionais', 'financeiroRelatorios'],
  ['/financeiro/fluxo', 'financeiroRelatorios'],
  ['/financeiro/despesas', 'financeiroRelatorios'],
  ['/financeiro/clientes-debito', 'financeiroRelatorios'],
  ['/financeiro/credito-cliente', 'financeiroRelatorios'],
  ['/financeiro/contas', 'financeiroRelatorios'],
  ['/financeiro/exportacao', 'financeiroRelatorios'],
  ['/financeiro/antecipacao', 'financeiroRelatorios'],
  ['/financeiro/motivos-desconto', 'financeiroRelatorios'],
  ['/financeiro', 'financeiro'],
  ['/relatorios', 'relatorios'],
  ['/configuracoes', 'configuracoes'],
  ['/noivas', 'noivas'],
  ['/contratos', 'contratos'],
  ['/campanhas', 'campanhas'],
  ['/dashboard', 'dashboard'],
];

/** `/financeiro` cobre `/financeiro/caixa`, mas não cobriria `/financeiro-x`. */
function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Diz se um destino do menu ou uma rota está liberado.
 * Aceita query string (`/clientes?filtro=…`) e param de rota (`/comanda/:id`).
 */
export function isPathEnabled(to: string): boolean {
  const exact = GATED_PATHS.find(([p]) => p === to);
  if (exact) return FEATURES[exact[1]];

  const pathname = to.split('?')[0];
  const gate = GATED_PATHS.find(
    ([p]) => !p.includes('?') && matches(pathname, p),
  );
  return gate ? FEATURES[gate[1]] : true;
}
