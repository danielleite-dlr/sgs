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
        searchTerms: ['financeiro', 'caixa', 'fluxo'],
      },
      {
        id: 'fin-comandas',
        label: 'Comandas',
        to: '/comanda/demo',
        icon: Receipt,
        searchTerms: ['comanda', 'venda', 'atendimento'],
      },
      {
        id: 'fin-comissoes',
        label: 'Pagamento de Profissionais',
        children: [
          {
            id: 'fin-comissoes-regras',
            label: 'Regras de comissão',
            to: '/catalogo/comissoes',
            searchTerms: ['comissao regra'],
          },
          {
            id: 'fin-comissoes-calc',
            label: 'Comissões calculadas',
            to: '/financeiro/comissoes',
            icon: BadgeDollarSign,
            searchTerms: ['comissao', 'comissao calculada'],
          },
        ],
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
        searchTerms: ['relatorio', 'dashboard'],
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
    to: '/configuracoes',
    icon: Settings,
    searchTerms: ['config', 'ajustes', 'preferencias'],
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
