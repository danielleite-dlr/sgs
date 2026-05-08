import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  UserCog,
  ShoppingBag,
  Scissors,
  Package as PkgIcon,
  Folder as FolderIcon,
  DollarSign,
  Receipt,
  BadgeDollarSign,
  Heart,
  FileText,
  BarChart3,
  Megaphone,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  to?: string;
  icon?: LucideIcon;
  children?: MenuItem[];
  searchTerms?: string[];
  badge?: 'lowStock';
}

/**
 * Trinks-style hierarchical menu (max 3 levels).
 *
 * Drives:
 *   - Desktop sidebar (SidebarNav)
 *   - Mobile drawer (AppDrawer)
 *   - Global search ("Buscar páginas no SGS")
 */
export const MENU: MenuItem[] = [
  {
    id: 'home',
    label: 'Início',
    to: '/dashboard',
    icon: LayoutDashboard,
    searchTerms: ['painel', 'home', 'inicio', 'dashboard'],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    icon: CalendarDays,
    children: [
      {
        id: 'agenda-minha',
        label: 'Minha agenda',
        to: '/agenda',
        searchTerms: ['agenda', 'agendamento', 'horario'],
      },
      {
        id: 'agenda-consulta',
        label: 'Consultar agendamentos',
        to: '/agenda?modo=relatorio',
        searchTerms: ['relatorio agendamentos', 'consulta'],
      },
    ],
  },
  {
    id: 'estabelecimento',
    label: 'Meu Estabelecimento',
    icon: Building2,
    children: [
      {
        id: 'clientes',
        label: 'Clientes',
        icon: Users,
        children: [
          {
            id: 'clientes-todos',
            label: 'Todos os clientes',
            to: '/clientes',
            searchTerms: ['clientes', 'cadastro cliente'],
          },
          {
            id: 'clientes-aniversariantes',
            label: 'Aniversariantes',
            to: '/clientes?filtro=aniversariantes',
            searchTerms: ['aniversariante', 'aniversario'],
          },
          {
            id: 'clientes-ranking',
            label: 'Ranking de clientes',
            to: '/clientes/ranking',
            searchTerms: ['ranking cliente', 'top cliente'],
          },
        ],
      },
      {
        id: 'profissionais',
        label: 'Profissionais',
        icon: UserCog,
        children: [
          {
            id: 'profissionais-todos',
            label: 'Todos os profissionais',
            to: '/profissionais',
            searchTerms: ['profissional', 'equipe', 'time'],
          },
          {
            id: 'profissionais-perfis',
            label: 'Perfis de acesso',
            to: '/profissionais/perfis',
            searchTerms: ['permissao', 'rbac', 'perfil acesso'],
          },
          {
            id: 'profissionais-ranking',
            label: 'Ranking de profissionais',
            to: '/profissionais/ranking',
            searchTerms: ['ranking profissional'],
          },
        ],
      },
      {
        id: 'servicos',
        label: 'Serviços',
        icon: Scissors,
        children: [
          {
            id: 'servicos-todos',
            label: 'Todos os serviços',
            to: '/catalogo/servicos',
            searchTerms: ['servico', 'cardapio'],
          },
          {
            id: 'servicos-ranking',
            label: 'Ranking de serviços',
            to: '/catalogo/servicos/ranking',
            searchTerms: ['ranking servico'],
          },
        ],
      },
      {
        id: 'produtos',
        label: 'Produtos',
        icon: ShoppingBag,
        badge: 'lowStock',
        children: [
          {
            id: 'produtos-todos',
            label: 'Todos os produtos',
            to: '/catalogo/produtos',
            badge: 'lowStock',
            searchTerms: ['produto', 'estoque'],
          },
          {
            id: 'produtos-ranking',
            label: 'Ranking de produtos',
            to: '/catalogo/produtos/ranking',
            searchTerms: ['ranking produto'],
          },
        ],
      },
      {
        id: 'pacotes',
        label: 'Pacotes',
        icon: PkgIcon,
        children: [
          {
            id: 'pacotes-todos',
            label: 'Pacotes cadastrados',
            to: '/catalogo/pacotes',
            searchTerms: ['pacote', 'combo'],
          },
        ],
      },
      {
        id: 'categorias',
        label: 'Categorias',
        to: '/catalogo/categorias',
        icon: FolderIcon,
        searchTerms: ['categoria'],
      },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    children: [
      {
        id: 'fin-controle',
        label: 'Controle de entrada e saída',
        to: '/financeiro',
        searchTerms: ['financeiro', 'controle', 'entrada saida'],
      },
      {
        id: 'fin-caixa',
        label: 'Financeiro — Caixa',
        to: '/financeiro/caixa',
        searchTerms: ['caixa', 'movimentações', 'sangria'],
      },
      {
        id: 'fin-pagamento-prof',
        label: 'Pagamento de Profissionais',
        to: '/financeiro/pagamento-profissionais',
        icon: BadgeDollarSign,
        searchTerms: ['pagamento profissional', 'comissão', 'gorjeta', 'fechamento'],
      },
      {
        id: 'fin-fluxo',
        label: 'Fluxo financeiro por forma de pagamento',
        to: '/financeiro/fluxo',
        searchTerms: ['fluxo', 'forma pagamento', 'pix', 'cartão'],
      },
      {
        id: 'fin-despesas',
        label: 'Despesas / Contas a Pagar',
        to: '/financeiro/despesas',
        searchTerms: ['despesa', 'conta a pagar'],
      },
      {
        id: 'fin-clientes-debito',
        label: 'Clientes em débito',
        to: '/financeiro/clientes-debito',
        searchTerms: ['débito', 'inadimplência'],
      },
      {
        id: 'fin-credito',
        label: 'Crédito de cliente',
        to: '/financeiro/credito-cliente',
        searchTerms: ['crédito', 'saldo cliente'],
      },
      {
        id: 'fin-contas',
        label: 'Contas financeiras',
        to: '/financeiro/contas',
        searchTerms: ['contas financeiras', 'conta bancária'],
      },
      {
        id: 'fin-exportacao',
        label: 'Exportação Lançamentos Financeiros',
        to: '/financeiro/exportacao',
        searchTerms: ['exportação', 'csv', 'excel'],
      },
      {
        id: 'fin-antecipacao',
        label: 'Lançamento de antecipação',
        to: '/financeiro/antecipacao',
        searchTerms: ['antecipação'],
      },
      {
        id: 'fin-motivos',
        label: 'Motivos de desconto',
        to: '/financeiro/motivos-desconto',
        searchTerms: ['motivo desconto'],
      },
      {
        id: 'fin-comandas',
        label: 'Comandas',
        to: '/comanda/demo',
        icon: Receipt,
        searchTerms: ['comanda', 'venda', 'atendimento'],
      },
      {
        id: 'fin-regras-comissao',
        label: 'Regras de comissão',
        to: '/catalogo/comissoes',
        searchTerms: ['comissao regra'],
      },
    ],
  },
  {
    id: 'eventos',
    label: 'Eventos',
    icon: Heart,
    children: [
      {
        id: 'noivas',
        label: 'Grupos de Noivas',
        to: '/noivas',
        searchTerms: ['noiva', 'casamento', 'grupo'],
      },
      {
        id: 'contratos',
        label: 'Contratos',
        to: '/contratos',
        icon: FileText,
        searchTerms: ['contrato'],
      },
    ],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: BarChart3,
    children: [
      {
        id: 'rel-principais',
        label: 'Principais',
        to: '/relatorios',
        searchTerms: ['relatorio', 'dashboard', 'principais'],
      },
      {
        id: 'rel-dashboard',
        label: 'Dashboard',
        to: '/relatorios/dashboard',
        searchTerms: ['dashboard'],
      },
      {
        id: 'rel-dre',
        label: 'Demonstrativo de Resultado',
        to: '/relatorios/dre',
        searchTerms: ['dre', 'demonstrativo'],
      },
      {
        id: 'rel-rankings',
        label: 'Rankings',
        to: '/relatorios/rankings',
        searchTerms: ['ranking'],
      },
      {
        id: 'rel-pesquisa',
        label: 'Pesquisa de satisfação',
        to: '/relatorios/satisfacao',
        searchTerms: ['nps', 'satisfação'],
      },
      {
        id: 'rel-mapa',
        label: 'Mapa de calor',
        to: '/relatorios/mapa-calor',
        searchTerms: ['mapa de calor', 'heatmap'],
      },
      {
        id: 'rel-retorno',
        label: 'Relatórios de retorno',
        to: '/relatorios/retorno',
        searchTerms: ['retorno', 'recorrência'],
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    children: [
      {
        id: 'campanhas',
        label: 'Campanhas',
        to: '/campanhas',
        searchTerms: ['campanha', 'whatsapp', 'sms', 'email'],
      },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    icon: Settings,
    children: [
      {
        id: 'config-todas',
        label: 'Todas as configurações',
        to: '/configuracoes',
        searchTerms: ['config', 'ajustes'],
      },
      {
        id: 'config-sistema',
        label: 'Configurações do sistema',
        to: '/configuracoes/sistema',
        searchTerms: ['sistema'],
      },
      {
        id: 'config-adicionais',
        label: 'Configurações de adicionais',
        to: '/configuracoes/adicionais',
        searchTerms: ['adicionais', 'nfse', 'nfce', 'fidelidade'],
      },
    ],
  },
];

/**
 * Flatten menu for global search.
 * Returns leaf items (those with `to`).
 */
export function flattenMenu(items: MenuItem[] = MENU, breadcrumb: string[] = []): Array<{
  item: MenuItem;
  path: string[];
}> {
  const result: Array<{ item: MenuItem; path: string[] }> = [];
  for (const item of items) {
    const currentPath = [...breadcrumb, item.label];
    if (item.to) {
      result.push({ item, path: currentPath });
    }
    if (item.children) {
      result.push(...flattenMenu(item.children, currentPath));
    }
  }
  return result;
}

/**
 * Search menu items by label or searchTerms.
 * Case-insensitive, accent-insensitive.
 */
export function searchMenu(query: string): Array<{ item: MenuItem; path: string[] }> {
  const q = normalize(query);
  if (!q) return [];
  return flattenMenu().filter(({ item, path }) => {
    const hay = [
      item.label,
      ...(item.searchTerms ?? []),
      ...path,
    ]
      .map(normalize)
      .join(' ');
    return hay.includes(q);
  });
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
