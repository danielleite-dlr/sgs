import { ROLE_PERMISSIONS } from '../permissions.catalog';
import { ACCESS_ITEMS } from './access-catalog';
import {
  checkAccess,
  expandGates,
  hasCostVisibility,
  isGranted,
  resolveAccess,
} from './access-resolve';

type Role = 'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL';
type Override = { itemId: string; enabled: boolean };

const ALL_IDS = [
  'agenda',
  'clientes-todos',
  'profissionais-todos',
  'profissionais-perfis',
  'servicos-todos',
  'produtos-todos',
  'pacotes-todos',
  'categorias',
  'fin-controle',
  'fin-previsao',
  'fin-despesas-fixas',
  'fin-comissoes',
  'fin-credito',
  'fin-comandas',
  'fin-regras-comissao',
  'noivas',
  'contratos',
  'comercial-painel',
  'comercial-leads',
  'comercial-pipeline',
  'comercial-lembretes',
  'comercial-relatorios',
  'comercial-config',
];

/** Matriz padrão aprovada (D-14, D-16): itens LIGADOS por papel, sem override. */
const EXPECTED_DEFAULTS: Record<Role, string[]> = {
  ADMIN: ALL_IDS,
  MANAGER: ALL_IDS,
  ATTENDANT: [
    'agenda',
    'clientes-todos',
    'profissionais-todos',
    'servicos-todos',
    'produtos-todos',
    'pacotes-todos',
    'categorias',
    'fin-credito',
    'fin-comandas',
    'noivas',
    'contratos',
    'comercial-painel',
    'comercial-leads',
    'comercial-pipeline',
    'comercial-lembretes',
  ],
  PROFESSIONAL: [
    'agenda',
    'clientes-todos',
    'profissionais-todos',
    'servicos-todos',
    'produtos-todos',
    'pacotes-todos',
    'categorias',
    'fin-comissoes',
    'fin-comandas',
  ],
};

function access(role: Role, overrides: Override[] = []) {
  return resolveAccess({
    roleName: role,
    rolePermissions: ROLE_PERMISSIONS[role],
    overrides,
  });
}

describe('10 — resolveAccess', () => {
  it('o catálogo tem os 23 ids da matriz', () => {
    expect(ACCESS_ITEMS.map((i) => i.id).sort()).toEqual([...ALL_IDS].sort());
  });

  const cases: Array<[Role, string, boolean]> = [];
  for (const role of Object.keys(EXPECTED_DEFAULTS) as Role[]) {
    for (const id of ALL_IDS) {
      cases.push([role, id, EXPECTED_DEFAULTS[role].includes(id)]);
    }
  }
  it.each(cases)('padrão %s / %s => ligado=%s', (role, id, enabled) => {
    const item = access(role).items.get(id)!;
    expect(item.enabled).toBe(enabled);
    expect(item.defaultEnabled).toBe(enabled);
    expect(item.source).toBe('DEFAULT');
  });

  it('contagens da matriz: 23, 23, 15 e 9', () => {
    expect(EXPECTED_DEFAULTS.ADMIN).toHaveLength(23);
    expect(EXPECTED_DEFAULTS.MANAGER).toHaveLength(23);
    expect(EXPECTED_DEFAULTS.ATTENDANT).toHaveLength(15);
    expect(EXPECTED_DEFAULTS.PROFESSIONAL).toHaveLength(9);
  });

  it('ATTENDANT sem override: fin-controle desligado, sem permissões', () => {
    const item = access('ATTENDANT').items.get('fin-controle')!;
    expect(item).toMatchObject({
      enabled: false,
      defaultEnabled: false,
      source: 'DEFAULT',
    });
    expect(item.permissions.size).toBe(0);
  });

  it('ATTENDANT + fin-controle ligado ganha financial.read e custo', () => {
    const a = access('ATTENDANT', [{ itemId: 'fin-controle', enabled: true }]);
    const item = a.items.get('fin-controle')!;
    expect(item.enabled).toBe(true);
    expect(item.source).toBe('GRANTED');
    expect(item.permissions.has('financial.read')).toBe(true);
    for (const p of ROLE_PERMISSIONS.ATTENDANT) {
      expect(item.permissions.has(p)).toBe(true);
    }
    expect(a.permissions.has('financial.read')).toBe(true);
    expect(isGranted(a, 'fin-controle')).toBe(true);
    expect(hasCostVisibility(a)).toBe(true);
    expect(hasCostVisibility(access('ATTENDANT'))).toBe(false);
  });

  it('MANAGER + fin-controle desligado: DENIED e ITEM_DISABLED', () => {
    const a = access('MANAGER', [{ itemId: 'fin-controle', enabled: false }]);
    const item = a.items.get('fin-controle')!;
    expect(item).toMatchObject({ enabled: false, source: 'DENIED' });
    expect(item.permissions.size).toBe(0);
    expect(checkAccess(a, ['fin-controle'], ['financial.read'])).toEqual({
      ok: false,
      reason: 'ITEM_DISABLED',
      missing: ['financial.read'],
    });
  });

  it('override igual ao padrão é no-op', () => {
    const a = access('MANAGER', [{ itemId: 'agenda', enabled: true }]);
    expect(a.items.get('agenda')!.source).toBe('DEFAULT');
  });

  it('override do ADMIN é ignorado (D-08)', () => {
    const a = access('ADMIN', [{ itemId: 'fin-controle', enabled: false }]);
    expect(a.items.get('fin-controle')).toMatchObject({
      enabled: true,
      source: 'DEFAULT',
    });
  });

  it.each(['PROFESSIONAL', 'ATTENDANT'] as const)(
    '%s não ganha profissionais-perfis (D-09)',
    (role) => {
      const a = access(role, [{ itemId: 'profissionais-perfis', enabled: true }]);
      expect(a.items.get('profissionais-perfis')!.enabled).toBe(false);
    },
  );

  it('override com id desconhecido é ignorado', () => {
    const a = access('ATTENDANT', [{ itemId: 'xyz', enabled: true }]);
    expect(a.items.has('xyz')).toBe(false);
    expect(a.items.size).toBe(23);
  });

  it('Pitfall 4: comercial-relatorios não dá manage em leads/pipeline', () => {
    const a = access('ATTENDANT', [
      { itemId: 'comercial-relatorios', enabled: true },
    ]);
    expect(
      checkAccess(a, ['comercial-relatorios'], ['commercial.manage']),
    ).toEqual({ ok: true });
    expect(checkAccess(a, ['COMERCIAL_NEGOCIOS'], ['commercial.manage'])).toEqual(
      { ok: false, reason: 'MISSING_PERMISSIONS', missing: ['commercial.manage'] },
    );
  });

  it('PROFESSIONAL + comercial-leads passa em COMERCIAL_NEGOCIOS (D-05)', () => {
    const a = access('PROFESSIONAL', [
      { itemId: 'comercial-leads', enabled: true },
    ]);
    expect(checkAccess(a, ['COMERCIAL_NEGOCIOS'], ['commercial.manage'])).toEqual({
      ok: true,
    });
  });

  it('Pitfall 5: PROFESSIONAL + noivas escreve noivas, agenda segue o papel', () => {
    const a = access('PROFESSIONAL', [{ itemId: 'noivas', enabled: true }]);
    expect(
      checkAccess(a, ['NOIVAS_CONTRATOS'], ['bridal.write', 'appointment.write']),
    ).toEqual({ ok: true });
    expect(checkAccess(a, ['agenda'], ['appointment.write'])).toEqual({
      ok: false,
      reason: 'MISSING_PERMISSIONS',
      missing: ['appointment.write'],
    });
  });

  it('porteiro CLIENTES_REF é OU entre os consumidores', () => {
    const off = (id: string): Override => ({ itemId: id, enabled: false });
    const a = access('PROFESSIONAL', [off('agenda')]);
    expect(checkAccess(a, ['CLIENTES_REF'], ['client.read'])).toEqual({ ok: true });
    const b = access('PROFESSIONAL', [
      off('agenda'),
      off('clientes-todos'),
      off('fin-comandas'),
    ]);
    expect(checkAccess(b, ['CLIENTES_REF'], ['client.read'])).toMatchObject({
      ok: false,
      reason: 'ITEM_DISABLED',
    });
  });

  it('sem porteiro usa só as permissões do papel', () => {
    const a = access('ATTENDANT');
    expect(checkAccess(a, [], ['notification.read'])).toEqual({ ok: true });
    expect(checkAccess(a, [], ['financial.read'])).toEqual({
      ok: false,
      reason: 'MISSING_PERMISSIONS',
      missing: ['financial.read'],
    });
  });

  it('expandGates une sem repetição e descarta nomes desconhecidos', () => {
    const out = expandGates(['CLIENTES_REF', 'agenda', 'NAO_EXISTE']);
    expect(new Set(out).size).toBe(out.length);
    expect(out).toContain('clientes-todos');
    expect(out).toContain('agenda');
    expect(out).not.toContain('NAO_EXISTE');
  });
});
