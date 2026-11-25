import { readFileSync } from 'fs';
import * as path from 'path';
import { ROLE_PERMISSIONS } from '../permissions.catalog';
import {
  ACCESS_GATES,
  ACCESS_ITEMS,
  ACCESS_ITEM_IDS,
  ALWAYS_ON_MENU_IDS,
  PLACEHOLDER_MENU_IDS,
} from './access-catalog';

const MENU_CONFIG = path.resolve(
  __dirname,
  '../../../../frontend/src/components/layout/menu-config.ts',
);

/**
 * Extrai os ids das folhas do menu (itens com `to:`).
 * O arquivo é formatado com `id: '...'` seguido de `label` e, nas folhas,
 * de `to: '...'` antes do próximo `id:`. A regex captura cada id e o trecho
 * até o próximo `id:`; o id é folha se esse trecho tem `to: '`.
 */
function leafIdsFromMenu(): string[] {
  const src = readFileSync(MENU_CONFIG, 'utf8');
  const re = /id:\s*'([^']+)'([\s\S]*?)(?=\bid:\s*'|$)/g;
  const leaves: string[] = [];
  for (const m of src.matchAll(re)) {
    // Só o trecho até o primeiro `children:` pertence ao próprio item.
    const own = m[2].split(/children:/)[0];
    if (/\bto:\s*'/.test(own)) leaves.push(m[1]);
  }
  return leaves;
}

describe('10 — catálogo de itens de acesso', () => {
  it('ids são únicos', () => {
    const ids = ACCESS_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(23);
  });

  it('requires não vazio e contido em managerPermissions', () => {
    for (const item of ACCESS_ITEMS) {
      expect(item.requires.length).toBeGreaterThan(0);
      for (const p of item.requires) {
        expect(item.managerPermissions).toContain(p);
      }
    }
  });

  it('managerPermissions está contido nas permissões do Gerente', () => {
    const manager = new Set<string>(ROLE_PERMISSIONS.MANAGER);
    for (const item of ACCESS_ITEMS) {
      for (const p of item.managerPermissions) {
        expect({ id: item.id, p, ok: manager.has(p) }).toEqual({
          id: item.id,
          p,
          ok: true,
        });
      }
    }
  });

  it('todo id dos porteiros existe no catálogo', () => {
    for (const ids of Object.values(ACCESS_GATES)) {
      for (const id of ids) expect(ACCESS_ITEM_IDS.has(id)).toBe(true);
    }
  });

  it('só profissionais-perfis não é concedível', () => {
    expect(ACCESS_ITEMS.filter((i) => !i.grantable).map((i) => i.id)).toEqual([
      'profissionais-perfis',
    ]);
  });

  describe('paridade com menu-config.ts', () => {
    const leaves = leafIdsFromMenu();
    const items = [...ACCESS_ITEM_IDS];
    const placeholders = [...PLACEHOLDER_MENU_IDS];
    const alwaysOn = [...ALWAYS_ON_MENU_IDS];

    it('encontra folhas no menu', () => {
      expect(leaves.length).toBeGreaterThan(20);
    });

    it('os três conjuntos são disjuntos', () => {
      const all = [...items, ...placeholders, ...alwaysOn];
      expect(new Set(all).size).toBe(all.length);
    });

    it('folhas do menu = itens + placeholders + sempre ligados', () => {
      const expected = new Set([...items, ...placeholders, ...alwaysOn]);
      const actual = new Set(leaves);
      expect([...actual].filter((id) => !expected.has(id))).toEqual([]);
      expect([...expected].filter((id) => !actual.has(id))).toEqual([]);
    });
  });
});
