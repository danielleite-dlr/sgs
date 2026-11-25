import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { homePathFor } from '@/config/features';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { HomeRoute } from '@/pages/HomeRoute';
import { AccessRoute } from '../AccessRoute';
import type { AccessItemData, MyAccessData } from '../access.api';

vi.mock('@/pages/DashboardPage', () => ({ default: () => <div>painel</div> }));

function item(id: string, enabled: boolean): AccessItemData {
  return {
    id,
    label: id,
    group: 'g',
    groupLabel: 'G',
    enabled,
    defaultEnabled: enabled,
    source: 'DEFAULT',
    adjustable: true,
    lockReason: null,
    permissions: [],
  };
}

function setAccess(items: AccessItemData[] | null, fresh: boolean, roleName = 'PROFESSIONAL') {
  const access: MyAccessData | null = items
    ? { memberId: 'm1', roleName, permissions: [], canManageAccess: false, items }
    : null;
  useAuthStore.setState({ access, accessFresh: fresh, roleName });
}

function renderAt(path: string, items: readonly string[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<HomeRoute />} />
        <Route path="/agenda" element={<div>agenda</div>} />
        <Route
          path="/financeiro"
          element={
            <AccessRoute items={items}>
              <div>financeiro</div>
            </AccessRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => useAuthStore.setState({ access: null, accessFresh: false, roleName: null }));

describe('homePathFor', () => {
  it('escolhe a tela inicial pelo papel e pela Agenda', () => {
    expect(homePathFor('PROFESSIONAL', true)).toBe('/agenda');
    expect(homePathFor('PROFESSIONAL', false)).toBe('/dashboard');
    expect(homePathFor('MANAGER', true)).toBe('/dashboard');
  });
});

describe('AccessRoute', () => {
  it('item desligado com acesso fresco leva à tela inicial', () => {
    setAccess([item('fin-controle', false), item('agenda', true)], true);
    renderAt('/financeiro', ['fin-controle']);
    expect(screen.getByText('agenda')).toBeInTheDocument();
  });

  it('item ligado mostra os filhos', () => {
    setAccess([item('fin-controle', true)], true);
    renderAt('/financeiro', ['fin-controle']);
    expect(screen.getByText('financeiro')).toBeInTheDocument();
  });

  it('acesso não fresco e item desligado mostra esqueleto, sem navegar', () => {
    setAccess([item('fin-controle', false), item('agenda', true)], false);
    renderAt('/financeiro', ['fin-controle']);
    expect(screen.getByTestId('access-route-loading')).toBeInTheDocument();
    expect(screen.queryByText('agenda')).not.toBeInTheDocument();
  });

  it('sem acesso carregado mostra os filhos', () => {
    setAccess(null, false);
    renderAt('/financeiro', ['fin-controle']);
    expect(screen.getByText('financeiro')).toBeInTheDocument();
  });

  it('profissional sem Agenda cai no painel, sem laço nem logout', () => {
    setAccess([item('fin-controle', false), item('agenda', false)], true);
    useAuthStore.setState({ accessToken: 'tok' });
    renderAt('/financeiro', ['fin-controle']);
    expect(screen.getByText('painel')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('tok');
  });

  it('OU: basta um dos itens ligado', () => {
    setAccess([item('comercial-leads', false), item('comercial-pipeline', true)], true);
    renderAt('/financeiro', ['comercial-leads', 'comercial-pipeline']);
    expect(screen.getByText('financeiro')).toBeInTheDocument();
  });
});
