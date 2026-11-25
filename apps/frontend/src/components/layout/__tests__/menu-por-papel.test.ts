import { describe, expect, it } from 'vitest';
import {
  MENU,
  MENU_DEFINITION,
  flattenMenu,
  menuForAccess,
  menuForRole,
  searchMenu,
  type MenuItem,
} from '../menu-config';
import { FINANCEIRO, PADRAO_PROFISSIONAL, accessWith } from './access-fixture';

function ids(items: readonly MenuItem[]): string[] {
  const out: string[] = [];
  for (const i of items) {
    out.push(i.id);
    if (i.children) out.push(...ids(i.children));
  }
  return out;
}

const FILHOS = [
  'comercial-painel',
  'comercial-leads',
  'comercial-pipeline',
  'comercial-lembretes',
  'comercial-relatorios',
  'comercial-config',
];

const COMERCIAL = FILHOS;
const ATENDENTE_COMERCIAL = [
  'comercial-painel',
  'comercial-leads',
  'comercial-pipeline',
  'comercial-lembretes',
];

describe('menu por acesso: Comercial (D-11, D-13)', () => {
  it('Comercial é o último grupo do menu', () => {
    expect(MENU_DEFINITION.at(-1)?.id).toBe('comercial');
    expect(menuForAccess(accessWith(COMERCIAL), 'ADMIN').at(-1)?.id).toBe('comercial');
  });

  it('PROFESSIONAL com o acesso padrão não vê o Comercial em nível nenhum', () => {
    const todos = ids(menuForAccess(accessWith(PADRAO_PROFISSIONAL), 'PROFESSIONAL'));
    expect(todos).not.toContain('comercial');
    for (const f of FILHOS) expect(todos).not.toContain(f);
  });

  it('ATTENDANT com o padrão vê 4 filhos, sem Relatórios nem Etapas e formulário', () => {
    const grupo = menuForAccess(accessWith(ATENDENTE_COMERCIAL, COMERCIAL), 'ATTENDANT').find(
      (i) => i.id === 'comercial',
    );
    expect(grupo?.children?.map((c) => c.id)).toEqual(ATENDENTE_COMERCIAL);
  });

  it('ADMIN e MANAGER com tudo ligado veem os 6 filhos', () => {
    for (const papel of ['ADMIN', 'MANAGER']) {
      const grupo = menuForAccess(accessWith(COMERCIAL), papel).find((i) => i.id === 'comercial');
      expect(grupo?.children?.map((c) => c.id)).toEqual(FILHOS);
    }
  });

  it('o menu do produto não tem mais roles fixos', () => {
    expect(JSON.stringify(MENU_DEFINITION)).not.toContain('roles');
  });

  it('busca não acha Leads com Comercial desligado', () => {
    const sem = menuForAccess(accessWith(PADRAO_PROFISSIONAL), 'PROFESSIONAL');
    expect(searchMenu('leads', sem)).toEqual([]);
    const com = menuForAccess(accessWith(ATENDENTE_COMERCIAL), 'ATTENDANT');
    expect(searchMenu('leads', com).length).toBeGreaterThan(0);
  });
});

describe('menu por acesso efetivo (fase 10)', () => {
  const folhas = (l: readonly MenuItem[]) => flattenMenu([...l]).map((r) => r.item.id);

  it('PROFESSIONAL com o acesso padrão vê só as folhas ligadas, sem Eventos nem Comercial', () => {
    const menu = menuForAccess(accessWith(PADRAO_PROFISSIONAL), 'PROFESSIONAL');
    expect(folhas(menu).sort()).toEqual(['home', ...PADRAO_PROFISSIONAL].sort());
    const todos = ids(menu);
    expect(todos).not.toContain('eventos');
    expect(todos).not.toContain('comercial');
  });

  it('grupo Financeiro some quando todos os itens dele estão desligados', () => {
    const menu = menuForAccess(accessWith(['agenda', 'clientes-todos'], FINANCEIRO), 'MANAGER');
    expect(ids(menu)).not.toContain('financeiro');
  });

  it('Comercial aparece por item ligado, sem papel fixo', () => {
    const menu = menuForAccess(accessWith(['comercial-leads']), 'ATTENDANT');
    const grupo = menu.find((i) => i.id === 'comercial');
    expect(grupo?.children?.map((c) => c.id)).toEqual(['comercial-leads']);
  });

  it('home fica mesmo sem nenhum item ligado', () => {
    expect(folhas(menuForAccess(accessWith([]), 'ATTENDANT'))).toEqual(['home']);
  });

  it('sem myAccess cai no filtro antigo por papel', () => {
    expect(ids(menuForAccess(null, 'PROFESSIONAL'))).toEqual(ids(menuForRole('PROFESSIONAL')));
  });

  it('busca global não acha Financeiro para a profissional com acesso padrão', () => {
    const menu = menuForAccess(accessWith(PADRAO_PROFISSIONAL), 'PROFESSIONAL');
    const achados = searchMenu('financeiro', menu).map((r) => r.item.id);
    expect(achados).not.toContain('fin-controle');
    expect(achados).not.toContain('fin-previsao');
  });
});
