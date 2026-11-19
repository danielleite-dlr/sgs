import { describe, expect, it } from 'vitest';
import {
  MENU,
  MENU_DEFINITION,
  filterMenuByRole,
  flattenMenu,
  searchMenu,
  type MenuItem,
} from '../menu-config';

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

describe('menu por papel (D-11, D-13)', () => {
  it('Comercial é o último grupo do menu', () => {
    expect(MENU_DEFINITION.at(-1)?.id).toBe('comercial');
    expect(filterMenuByRole(MENU, 'ADMIN').at(-1)?.id).toBe('comercial');
  });

  it('PROFESSIONAL não vê o Comercial em nível nenhum', () => {
    const todos = ids(filterMenuByRole(MENU_DEFINITION, 'PROFESSIONAL'));
    expect(todos).not.toContain('comercial');
    for (const f of FILHOS) expect(todos).not.toContain(f);
  });

  it('ATTENDANT vê 4 filhos, sem Relatórios nem Etapas e formulário', () => {
    const menu = filterMenuByRole(MENU_DEFINITION, 'ATTENDANT');
    const grupo = menu.find((i) => i.id === 'comercial');
    expect(grupo?.children?.map((c) => c.id)).toEqual([
      'comercial-painel',
      'comercial-leads',
      'comercial-pipeline',
      'comercial-lembretes',
    ]);
  });

  it('ADMIN e MANAGER veem os 6 filhos', () => {
    for (const papel of ['ADMIN', 'MANAGER']) {
      const grupo = filterMenuByRole(MENU_DEFINITION, papel).find((i) => i.id === 'comercial');
      expect(grupo?.children?.map((c) => c.id)).toEqual(FILHOS);
    }
  });

  it('papel nulo remove todo item com roles', () => {
    const todos = ids(filterMenuByRole(MENU_DEFINITION, null));
    expect(todos).not.toContain('comercial');
    expect(todos).toContain('home');
  });

  it('item sem roles aparece para qualquer papel (menu atual inalterado)', () => {
    const semComercial = (l: readonly MenuItem[]) =>
      flattenMenu([...l])
        .map((r) => r.item.id)
        .filter((id) => !id.startsWith('comercial'));
    expect(semComercial(filterMenuByRole(MENU, 'PROFESSIONAL'))).toEqual(semComercial(MENU));
  });

  it('busca não acha Leads para PROFESSIONAL', () => {
    expect(searchMenu('leads', filterMenuByRole(MENU_DEFINITION, 'PROFESSIONAL'))).toEqual([]);
    expect(
      searchMenu('leads', filterMenuByRole(MENU_DEFINITION, 'ATTENDANT')).length,
    ).toBeGreaterThan(0);
  });
});
