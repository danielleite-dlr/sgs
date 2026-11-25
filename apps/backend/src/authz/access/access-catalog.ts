/**
 * Catálogo de itens de acesso (fase 10 — permissões por pessoa).
 *
 * - `id` é o mesmo id do submenu em `apps/frontend/src/components/layout/menu-config.ts`
 *   (o spec de paridade garante que os dois lados não divergem).
 * - `requires` define o PADRÃO de cada papel: o item fica ligado quando
 *   `requires ⊆ permissões do papel`.
 * - `managerPermissions` é o que quem GANHA o item passa a poder (igual ao Gerente).
 * - Ao ligar uma flag de placeholder do menu, o MESMO commit deve adicionar o
 *   item aqui (e tirá-lo de `PLACEHOLDER_MENU_IDS`), senão o spec de paridade quebra.
 *
 * Domínio puro: sem I/O, sem Nest, sem Prisma.
 */
import { PERMISSIONS as P, type Permission } from '../permissions.catalog';

export type AccessGroupId =
  | 'agenda'
  | 'clientes'
  | 'profissionais'
  | 'servicos'
  | 'produtos'
  | 'pacotes'
  | 'categorias'
  | 'financeiro'
  | 'eventos'
  | 'comercial';

export interface AccessItemDef {
  id: string;
  label: string;
  group: AccessGroupId;
  groupLabel: string;
  requires: readonly Permission[];
  managerPermissions: readonly Permission[];
  /** false = não pode ser ligado para ATTENDANT/PROFESSIONAL (D-09). */
  grantable: boolean;
}

export const ACCESS_ITEMS: readonly AccessItemDef[] = [
  {
    id: 'agenda',
    label: 'Agenda',
    group: 'agenda',
    groupLabel: 'Agenda',
    requires: [P.APPOINTMENT_READ],
    managerPermissions: [
      P.APPOINTMENT_READ,
      P.APPOINTMENT_WRITE,
      P.CLIENT_READ,
      P.CLIENT_WRITE,
    ],
    grantable: true,
  },
  {
    id: 'clientes-todos',
    label: 'Todos os clientes',
    group: 'clientes',
    groupLabel: 'Clientes',
    requires: [P.CLIENT_READ],
    managerPermissions: [P.CLIENT_READ, P.CLIENT_WRITE],
    grantable: true,
  },
  {
    id: 'profissionais-todos',
    label: 'Todos os profissionais',
    group: 'profissionais',
    groupLabel: 'Profissionais',
    requires: [P.MEMBER_READ],
    managerPermissions: [P.MEMBER_READ],
    grantable: true,
  },
  {
    id: 'profissionais-perfis',
    label: 'Perfis de acesso',
    group: 'profissionais',
    groupLabel: 'Profissionais',
    requires: [P.MEMBER_EDIT_ROLE],
    managerPermissions: [P.MEMBER_EDIT_ROLE],
    grantable: false,
  },
  {
    id: 'servicos-todos',
    label: 'Todos os serviços',
    group: 'servicos',
    groupLabel: 'Serviços',
    requires: [P.SERVICE_READ],
    managerPermissions: [P.SERVICE_READ, P.SERVICE_WRITE, P.CATEGORY_READ],
    grantable: true,
  },
  {
    id: 'produtos-todos',
    label: 'Todos os produtos',
    group: 'produtos',
    groupLabel: 'Produtos',
    requires: [P.PRODUCT_READ],
    managerPermissions: [
      P.PRODUCT_READ,
      P.PRODUCT_WRITE,
      P.PRODUCT_ADJUST_STOCK,
    ],
    grantable: true,
  },
  {
    id: 'pacotes-todos',
    label: 'Pacotes cadastrados',
    group: 'pacotes',
    groupLabel: 'Pacotes',
    requires: [P.PACKAGE_READ],
    managerPermissions: [P.PACKAGE_READ, P.PACKAGE_WRITE, P.SERVICE_READ],
    grantable: true,
  },
  {
    id: 'categorias',
    label: 'Categorias',
    group: 'categorias',
    groupLabel: 'Categorias',
    requires: [P.CATEGORY_READ],
    managerPermissions: [P.CATEGORY_READ, P.CATEGORY_WRITE],
    grantable: true,
  },
  {
    id: 'fin-controle',
    label: 'Controle de entrada e saída',
    group: 'financeiro',
    groupLabel: 'Financeiro',
    requires: [P.FINANCIAL_READ],
    managerPermissions: [P.FINANCIAL_READ],
    grantable: true,
  },
  {
    id: 'fin-previsao',
    label: 'Previsão de caixa',
    group: 'financeiro',
    groupLabel: 'Financeiro',
    requires: [P.FINANCIAL_READ],
    managerPermissions: [P.FINANCIAL_READ],
    grantable: true,
  },
  {
    id: 'fin-despesas-fixas',
    label: 'Despesas fixas',
    group: 'financeiro',
    groupLabel: 'Financeiro',
    requires: [P.FINANCIAL_READ],
    managerPermissions: [P.FINANCIAL_READ, P.FINANCIAL_EXPENSE_WRITE],
    grantable: true,
  },
  {
    id: 'fin-comissoes',
    label: 'Comissões calculadas',
    group: 'financeiro',
    groupLabel: 'Financeiro',
    requires: [P.COMMISSION_RECORD_READ],
    managerPermissions: [P.COMMISSION_RECORD_READ],
    grantable: true,
  },
  {
    id: 'fin-credito',
    label: 'Crédito de cliente',
    group: 'financeiro',
    groupLabel: 'Financeiro',
    requires: [P.CREDIT_READ],
    managerPermissions: [P.CREDIT_READ, P.CREDIT_ADJUST, P.CLIENT_READ],
    grantable: true,
  },
  {
    id: 'fin-comandas',
    label: 'Comandas',
    group: 'financeiro',
    groupLabel: 'Financeiro',
    requires: [P.COMANDA_READ],
    managerPermissions: [
      P.COMANDA_READ,
      P.COMANDA_WRITE,
      P.COMANDA_CLOSE,
      P.COMANDA_REOPEN,
      P.CLIENT_READ,
      P.CLIENT_WRITE,
    ],
    grantable: true,
  },
  {
    id: 'fin-regras-comissao',
    label: 'Regras de comissão',
    group: 'financeiro',
    groupLabel: 'Financeiro',
    requires: [P.COMMISSION_READ],
    managerPermissions: [P.COMMISSION_READ],
    grantable: true,
  },
  {
    id: 'noivas',
    label: 'Grupos de Noivas',
    group: 'eventos',
    groupLabel: 'Eventos',
    requires: [P.BRIDAL_READ],
    managerPermissions: [
      P.BRIDAL_READ,
      P.BRIDAL_WRITE,
      P.BRIDAL_AI_SUGGEST,
      P.BRIDAL_SCHEDULE_OVERRIDE,
      P.APPOINTMENT_READ,
      P.APPOINTMENT_WRITE,
      P.CONTRACT_READ,
    ],
    grantable: true,
  },
  {
    id: 'contratos',
    label: 'Contratos',
    group: 'eventos',
    groupLabel: 'Eventos',
    requires: [P.CONTRACT_READ],
    managerPermissions: [
      P.CONTRACT_READ,
      P.CONTRACT_WRITE,
      P.CONTRACT_PAYMENT,
      P.CONTRACT_CANCEL,
      P.BRIDAL_READ,
    ],
    grantable: true,
  },
  {
    id: 'comercial-painel',
    label: 'Painel comercial',
    group: 'comercial',
    groupLabel: 'Comercial',
    requires: [P.COMMERCIAL_READ],
    managerPermissions: [P.COMMERCIAL_READ],
    grantable: true,
  },
  {
    id: 'comercial-leads',
    label: 'Leads',
    group: 'comercial',
    groupLabel: 'Comercial',
    requires: [P.COMMERCIAL_READ],
    managerPermissions: [
      P.COMMERCIAL_READ,
      P.COMMERCIAL_WRITE,
      P.COMMERCIAL_MANAGE,
    ],
    grantable: true,
  },
  {
    id: 'comercial-pipeline',
    label: 'Pipeline',
    group: 'comercial',
    groupLabel: 'Comercial',
    requires: [P.COMMERCIAL_READ],
    managerPermissions: [
      P.COMMERCIAL_READ,
      P.COMMERCIAL_WRITE,
      P.COMMERCIAL_MANAGE,
    ],
    grantable: true,
  },
  {
    id: 'comercial-lembretes',
    label: 'Lembretes',
    group: 'comercial',
    groupLabel: 'Comercial',
    requires: [P.COMMERCIAL_READ],
    managerPermissions: [P.COMMERCIAL_READ, P.COMMERCIAL_WRITE],
    grantable: true,
  },
  {
    id: 'comercial-relatorios',
    label: 'Relatórios',
    group: 'comercial',
    groupLabel: 'Comercial',
    requires: [P.COMMERCIAL_READ, P.COMMERCIAL_MANAGE],
    managerPermissions: [P.COMMERCIAL_READ, P.COMMERCIAL_MANAGE],
    grantable: true,
  },
  {
    id: 'comercial-config',
    label: 'Etapas e formulário',
    group: 'comercial',
    groupLabel: 'Comercial',
    requires: [P.COMMERCIAL_READ, P.COMMERCIAL_MANAGE],
    managerPermissions: [
      P.COMMERCIAL_READ,
      P.COMMERCIAL_WRITE,
      P.COMMERCIAL_MANAGE,
    ],
    grantable: true,
  },
];

export type AccessItemId = string;

export const ACCESS_ITEM_IDS: ReadonlySet<string> = new Set(
  ACCESS_ITEMS.map((i) => i.id),
);

/** Folhas do menu que nunca são controladas (sempre visíveis). */
export const ALWAYS_ON_MENU_IDS = ['home'] as const;

/** Folhas do menu com a flag desligada (placeholders): ficam fora do catálogo. */
export const PLACEHOLDER_MENU_IDS: readonly string[] = [
  'clientes-aniversariantes',
  'clientes-ranking',
  'profissionais-ranking',
  'servicos-ranking',
  'produtos-ranking',
  'fin-caixa',
  'fin-pagamento-prof',
  'fin-fluxo',
  'fin-despesas',
  'fin-clientes-debito',
  'fin-contas',
  'fin-exportacao',
  'fin-antecipacao',
  'fin-motivos',
  'rel-principais',
  'rel-dashboard',
  'rel-dre',
  'rel-rankings',
  'rel-pesquisa',
  'rel-mapa',
  'rel-retorno',
  'campanhas',
  'config-todas',
  'config-sistema',
  'config-adicionais',
];

export type AccessGateName =
  | 'CLIENTES_REF'
  | 'CATALOGO_REF'
  | 'NOIVAS_CONTRATOS'
  | 'COMERCIAL_NEGOCIOS';

/**
 * Porteiros nomeados: leitura de dados de referência = OU entre o dono do dado
 * e os itens que o consomem.
 */
export const ACCESS_GATES: Record<AccessGateName, readonly string[]> = {
  CLIENTES_REF: [
    'clientes-todos',
    'agenda',
    'fin-comandas',
    'fin-credito',
    'noivas',
    'contratos',
    'comercial-leads',
    'comercial-pipeline',
  ],
  CATALOGO_REF: [
    'servicos-todos',
    'produtos-todos',
    'pacotes-todos',
    'categorias',
    'fin-regras-comissao',
    'agenda',
    'fin-comandas',
    'noivas',
    'contratos',
    'comercial-leads',
    'comercial-pipeline',
  ],
  NOIVAS_CONTRATOS: ['noivas', 'contratos'],
  COMERCIAL_NEGOCIOS: ['comercial-leads', 'comercial-pipeline'],
};
