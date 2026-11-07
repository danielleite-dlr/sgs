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
  ArrowLeftRight,
  Cake,
  CalendarCheck,
  CalendarClock,
  CalendarSearch,
  CreditCard,
  Download,
  FastForward,
  FileMinus,
  FileSpreadsheet,
  Flame,
  Gem,
  Landmark,
  LayoutList,
  List,
  Monitor,
  Percent,
  PieChart,
  PiggyBank,
  Puzzle,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Tag,
  TrendingUp,
  Trophy,
  UserX,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { isPathEnabled } from '@/config/features';

export interface MenuItem {
  id: string;
  label: string;
  to?: string;
  /** Obrigatório: todo item do menu tem ícone (quick 261107-jvl). */
  icon: LucideIcon;
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
const ALL_MENU: MenuItem[] = [
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
        icon: CalendarCheck,
        searchTerms: ['agenda', 'agendamento', 'horario'],
      },
      {
        id: 'agenda-consulta',
        label: 'Consultar agendamentos',
        to: '/agenda?modo=relatorio',
        icon: CalendarSearch,
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
            icon: List,
            searchTerms: ['clientes', 'cadastro cliente'],
          },
          {
            id: 'clientes-aniversariantes',
            label: 'Aniversariantes',
            to: '/clientes?filtro=aniversariantes',
            icon: Cake,
            searchTerms: ['aniversariante', 'aniversario'],
          },
          {
            id: 'clientes-ranking',
            label: 'Ranking de clientes',
            to: '/clientes/ranking',
            icon: Trophy,
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
            icon: List,
            searchTerms: ['profissional', 'equipe', 'time'],
          },
          {
            id: 'profissionais-perfis',
            label: 'Perfis de acesso',
            to: '/profissionais/perfis',
            icon: ShieldCheck,
            searchTerms: ['permissao', 'rbac', 'perfil acesso'],
          },
          {
            id: 'profissionais-ranking',
            label: 'Ranking de profissionais',
            to: '/profissionais/ranking',
            icon: Trophy,
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
            icon: List,
            searchTerms: ['servico', 'cardapio'],
          },
          {
            id: 'servicos-ranking',
            label: 'Ranking de serviços',
            to: '/catalogo/servicos/ranking',
            icon: Trophy,
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
            icon: List,
            badge: 'lowStock',
            searchTerms: ['produto', 'estoque'],
          },
          {
            id: 'produtos-ranking',
            label: 'Ranking de produtos',
            to: '/catalogo/produtos/ranking',
            icon: Trophy,
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
            icon: List,
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
        icon: ArrowLeftRight,
        searchTerms: ['financeiro', 'controle', 'entrada saida'],
      },
      {
        id: 'fin-previsao',
        label: 'Previsão de caixa',
        to: '/financeiro/previsao',
        icon: TrendingUp,
        searchTerms: ['previsão', 'previsão de caixa', 'fluxo de caixa', 'próximos 30 dias', 'saldo previsto'],
      },
      {
        id: 'fin-despesas-fixas',
        label: 'Despesas fixas',
        to: '/financeiro/despesas-fixas',
        icon: CalendarClock,
        searchTerms: ['despesas fixas', 'contas do mês', 'aluguel', 'previsão'],
      },
      {
        id: 'fin-caixa',
        label: 'Financeiro — Caixa',
        to: '/financeiro/caixa',
        icon: Wallet,
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
        id: 'fin-comissoes',
        label: 'Comissões calculadas',
        to: '/financeiro/comissoes',
        icon: Percent,
        searchTerms: ['comissão', 'comissões calculadas', 'profissional'],
      },
      {
        id: 'fin-fluxo',
        label: 'Fluxo financeiro por forma de pagamento',
        to: '/financeiro/fluxo',
        icon: CreditCard,
        searchTerms: ['fluxo', 'forma pagamento', 'pix', 'cartão'],
      },
      {
        id: 'fin-despesas',
        label: 'Despesas / Contas a Pagar',
        to: '/financeiro/despesas',
        icon: FileMinus,
        searchTerms: ['despesa', 'conta a pagar'],
      },
      {
        id: 'fin-clientes-debito',
        label: 'Clientes em débito',
        to: '/financeiro/clientes-debito',
        icon: UserX,
        searchTerms: ['débito', 'inadimplência'],
      },
      {
        id: 'fin-credito',
        label: 'Crédito de cliente',
        to: '/financeiro/credito-cliente',
        icon: PiggyBank,
        searchTerms: ['crédito', 'saldo cliente'],
      },
      {
        id: 'fin-contas',
        label: 'Contas financeiras',
        to: '/financeiro/contas',
        icon: Landmark,
        searchTerms: ['contas financeiras', 'conta bancária'],
      },
      {
        id: 'fin-exportacao',
        label: 'Exportação Lançamentos Financeiros',
        to: '/financeiro/exportacao',
        icon: Download,
        searchTerms: ['exportação', 'csv', 'excel'],
      },
      {
        id: 'fin-antecipacao',
        label: 'Lançamento de antecipação',
        to: '/financeiro/antecipacao',
        icon: FastForward,
        searchTerms: ['antecipação'],
      },
      {
        id: 'fin-motivos',
        label: 'Motivos de desconto',
        to: '/financeiro/motivos-desconto',
        icon: Tag,
        searchTerms: ['motivo desconto'],
      },
      {
        id: 'fin-comandas',
        label: 'Comandas',
        to: '/comanda',
        icon: Receipt,
        searchTerms: ['comanda', 'venda', 'atendimento'],
      },
      {
        id: 'fin-regras-comissao',
        label: 'Regras de comissão',
        to: '/catalogo/comissoes',
        icon: SlidersHorizontal,
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
        icon: Gem,
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
        icon: LayoutList,
        searchTerms: ['relatorio', 'dashboard', 'principais'],
      },
      {
        id: 'rel-dashboard',
        label: 'Dashboard',
        to: '/relatorios/dashboard',
        icon: PieChart,
        searchTerms: ['dashboard'],
      },
      {
        id: 'rel-dre',
        label: 'Demonstrativo de Resultado',
        to: '/relatorios/dre',
        icon: FileSpreadsheet,
        searchTerms: ['dre', 'demonstrativo'],
      },
      {
        id: 'rel-rankings',
        label: 'Rankings',
        to: '/relatorios/rankings',
        icon: Trophy,
        searchTerms: ['ranking'],
      },
      {
        id: 'rel-pesquisa',
        label: 'Pesquisa de satisfação',
        to: '/relatorios/satisfacao',
        icon: Smile,
        searchTerms: ['nps', 'satisfação'],
      },
      {
        id: 'rel-mapa',
        label: 'Mapa de calor',
        to: '/relatorios/mapa-calor',
        icon: Flame,
        searchTerms: ['mapa de calor', 'heatmap'],
      },
      {
        id: 'rel-retorno',
        label: 'Relatórios de retorno',
        to: '/relatorios/retorno',
        icon: RotateCcw,
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
        icon: Send,
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
        icon: Settings2,
        searchTerms: ['config', 'ajustes'],
      },
      {
        id: 'config-sistema',
        label: 'Configurações do sistema',
        to: '/configuracoes/sistema',
        icon: Monitor,
        searchTerms: ['sistema'],
      },
      {
        id: 'config-adicionais',
        label: 'Configurações de adicionais',
        to: '/configuracoes/adicionais',
        icon: Puzzle,
        searchTerms: ['adicionais', 'nfse', 'nfce', 'fidelidade'],
      },
    ],
  },
];

/**
 * Remove os destinos desligados em `config/features` e os grupos que ficam
 * vazios por causa disso. É o que separa o menu do produto do menu do mockup.
 */
function pruneMenu(items: MenuItem[]): MenuItem[] {
  const kept: MenuItem[] = [];
  for (const item of items) {
    const children = item.children ? pruneMenu(item.children) : undefined;
    const hadChildren = (item.children?.length ?? 0) > 0;
    // Grupo que perdeu todos os filhos some junto.
    if (hadChildren && children!.length === 0) continue;
    if (item.to && !isPathEnabled(item.to)) {
      // Folha desligada some; pai que virou casca vazia some no nível acima.
      if (!children || children.length === 0) continue;
      kept.push({ ...item, to: undefined, children });
      continue;
    }
    kept.push(children ? { ...item, children } : item);
  }
  return kept;
}

/** Menu efetivamente navegável — o que o usuário vê. */
export const MENU: MenuItem[] = pruneMenu(ALL_MENU);

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
