import { describe, expect, it } from 'vitest';
import { FEATURES, HOME_PATH, homePathForRole, isPathEnabled } from '../features';
import { MENU, flattenMenu } from '@/components/layout/menu-config';

describe('feature gating', () => {
  it('libera o que está pronto', () => {
    for (const path of [
      '/agenda',
      '/clientes',
      '/clientes/novo',
      '/clientes/:id',
      '/catalogo/servicos',
      '/catalogo/produtos',
      '/catalogo/comissoes',
      '/profissionais',
      '/financeiro',
      '/financeiro/comissoes',
      '/financeiro/credito-cliente',
      '/comanda',
      '/comanda/:id',
      '/dashboard',
      '/financeiro/previsao',
      '/financeiro/despesas-fixas',
    ]) {
      expect(isPathEnabled(path)).toBe(true);
    }
  });

  it('bloqueia os mockups, inclusive sub-rotas e query strings', () => {
    for (const path of [
      '/financeiro/caixa',
      '/relatorios',
      '/configuracoes/sistema',
      '/campanhas',
      '/profissionais/perfis',
      '/profissionais/ranking',
      '/clientes/ranking',
      '/clientes?filtro=aniversariantes',
      '/agenda?modo=relatorio',
    ]) {
      expect(isPathEnabled(path)).toBe(false);
    }
  });

  it('libera noivas e contratos (telas reais, flags ligadas em 04-15)', () => {
    for (const path of ['/noivas', '/noivas/:id', '/contratos', '/contratos/:id']) {
      expect(isPathEnabled(path)).toBe(true);
    }
  });

  it('não confunde prefixo com outro caminho de mesmo início', () => {
    expect(isPathEnabled('/financeiro-teste')).toBe(true);
  });

  it('painel é a home de ADMIN/MANAGER; demais papéis vão para a agenda (D-11)', () => {
    expect(FEATURES.dashboard).toBe(true);
    expect(HOME_PATH).toBe('/dashboard');
    expect(homePathForRole('ADMIN')).toBe('/dashboard');
    expect(homePathForRole('MANAGER')).toBe('/dashboard');
    expect(homePathForRole('PROFESSIONAL')).toBe('/agenda');
    expect(homePathForRole('ATTENDANT')).toBe('/agenda');
    expect(homePathForRole(null)).toBe('/agenda');
    expect(isPathEnabled('/financeiro/despesas')).toBe(false);
  });

  it('nenhum item do menu leva a destino desligado', () => {
    const destinos = flattenMenu(MENU).map(({ item }) => item.to!);
    expect(destinos.length).toBeGreaterThan(0);
    for (const destino of destinos) {
      expect(isPathEnabled(destino)).toBe(true);
    }
  });
});
