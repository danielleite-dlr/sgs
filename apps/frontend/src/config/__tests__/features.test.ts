import { describe, expect, it } from 'vitest';
import { FEATURES, HOME_PATH, isPathEnabled } from '../features';
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
    ]) {
      expect(isPathEnabled(path)).toBe(true);
    }
  });

  it('bloqueia os mockups, inclusive sub-rotas e query strings', () => {
    for (const path of [
      '/dashboard',
      '/comanda/:id',
      '/financeiro',
      '/financeiro/caixa',
      '/financeiro/comissoes',
      '/relatorios',
      '/configuracoes/sistema',
      '/noivas',
      '/contratos/:id',
      '/campanhas',
      '/profissionais',
      '/clientes/ranking',
      '/clientes?filtro=aniversariantes',
      '/agenda?modo=relatorio',
    ]) {
      expect(isPathEnabled(path)).toBe(false);
    }
  });

  it('não confunde prefixo com outro caminho de mesmo início', () => {
    expect(isPathEnabled('/financeiro-teste')).toBe(true);
  });

  it('manda a home para a agenda enquanto o dashboard é mockup', () => {
    expect(FEATURES.dashboard).toBe(false);
    expect(HOME_PATH).toBe('/agenda');
  });

  it('nenhum item do menu leva a destino desligado', () => {
    const destinos = flattenMenu(MENU).map(({ item }) => item.to!);
    expect(destinos.length).toBeGreaterThan(0);
    for (const destino of destinos) {
      expect(isPathEnabled(destino)).toBe(true);
    }
  });
});
