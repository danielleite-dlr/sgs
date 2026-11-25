import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AccessRoute } from '@/features/access/AccessRoute';
import type { AccessItemData } from '@/features/access/access.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CommercialSettingsPage } from '../pages/CommercialSettingsPage';

function item(id: string, enabled: boolean): AccessItemData {
  return {
    id,
    label: id,
    group: 'comercial',
    groupLabel: 'Comercial',
    enabled,
    defaultEnabled: enabled,
    source: 'DEFAULT',
    adjustable: true,
    lockReason: null,
    permissions: [],
  };
}

function setAccess(roleName: string, items: AccessItemData[]) {
  useAuthStore.setState({
    roleName,
    accessFresh: true,
    access: { memberId: 'm-1', roleName, permissions: [], canManageAccess: false, items },
  });
}

function renderRelatorios() {
  return render(
    <MemoryRouter initialEntries={['/comercial/relatorios']}>
      <Routes>
        <Route
          path="/comercial/relatorios"
          element={
            <AccessRoute items={['comercial-relatorios']}>
              <div>conteudo</div>
            </AccessRoute>
          }
        />
        <Route path="/agenda" element={<div>agenda</div>} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => useAuthStore.setState({ roleName: null, access: null, accessFresh: false }));

describe('rotas do Comercial por item de acesso', () => {
  it('Atendente sem comercial-relatorios vai para a home', () => {
    setAccess('ATTENDANT', [item('comercial-relatorios', false), item('agenda', true)]);
    renderRelatorios();
    expect(screen.getByText('agenda')).toBeInTheDocument();
  });

  it('Atendente com comercial-relatorios ganho abre a rota', () => {
    setAccess('ATTENDANT', [item('comercial-relatorios', true)]);
    renderRelatorios();
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });
});

describe('CommercialSettingsPage', () => {
  it('mostra as abas Etapas e Formulário do site', () => {
    render(
      <MockedProvider mocks={[]}>
        <MemoryRouter>
          <CommercialSettingsPage />
        </MemoryRouter>
      </MockedProvider>,
    );
    expect(screen.getByRole('tab', { name: 'Etapas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Formulário do site' })).toBeInTheDocument();
  });
});
