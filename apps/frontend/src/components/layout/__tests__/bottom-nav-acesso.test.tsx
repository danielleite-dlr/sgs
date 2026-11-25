import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@/infrastructure/i18n';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { BottomNav } from '../BottomNav';
import { accessWith } from './access-fixture';

const TODOS = ['agenda', 'fin-comandas', 'clientes-todos', 'noivas'];

function montar() {
  render(
    <MemoryRouter>
      <BottomNav onOpenMenu={() => undefined} />
    </MemoryRouter>,
  );
}

describe('BottomNav por acesso (fase 10)', () => {
  beforeEach(() => {
    useAuthStore.setState({ access: null });
  });

  it('mostra os quatro botões com tudo ligado', () => {
    useAuthStore.setState({ access: accessWith(TODOS) });
    montar();
    for (const l of ['Agenda', 'Comanda', 'Clientes', 'Noivas']) {
      expect(screen.queryByText(l)).not.toBeNull();
    }
  });

  it('esconde Noivas e Comanda quando os itens estão desligados', () => {
    useAuthStore.setState({ access: accessWith(['agenda', 'clientes-todos'], TODOS) });
    montar();
    expect(screen.queryByText('Noivas')).toBeNull();
    expect(screen.queryByText('Comanda')).toBeNull();
    expect(screen.queryByText('Agenda')).not.toBeNull();
    expect(screen.queryByText('Clientes')).not.toBeNull();
  });
});
