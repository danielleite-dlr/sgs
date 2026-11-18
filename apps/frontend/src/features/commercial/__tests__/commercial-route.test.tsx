import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CommercialRoute } from '../components/CommercialRoute';
import { CommercialSettingsPage } from '../pages/CommercialSettingsPage';
import { setRole } from './commercial-fixtures';

function renderAt(managerOnly: boolean) {
  return render(
    <MemoryRouter initialEntries={['/comercial/x']}>
      <Routes>
        <Route
          path="/comercial/x"
          element={
            <CommercialRoute managerOnly={managerOnly}>
              <div>conteudo</div>
            </CommercialRoute>
          }
        />
        <Route path="/comercial" element={<div>painel</div>} />
        <Route path="/agenda" element={<div>agenda</div>} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => setRole(null, null));

describe('CommercialRoute', () => {
  it('PROFESSIONAL vai para a home do papel', () => {
    setRole('PROFESSIONAL');
    renderAt(false);
    expect(screen.getByText('agenda')).toBeInTheDocument();
  });

  it('ATTENDANT em rota managerOnly volta para /comercial', () => {
    setRole('ATTENDANT');
    renderAt(true);
    expect(screen.getByText('painel')).toBeInTheDocument();
  });

  it('ATTENDANT vê rota comum; ADMIN vê rota managerOnly', () => {
    setRole('ATTENDANT');
    const a = renderAt(false);
    expect(screen.getByText('conteudo')).toBeInTheDocument();
    a.unmount();
    setRole('ADMIN');
    renderAt(true);
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });
});

describe('CommercialSettingsPage', () => {
  it('mostra as abas Etapas e Formulário do site', () => {
    render(
      <MemoryRouter>
        <CommercialSettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('tab', { name: 'Etapas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Formulário do site' })).toBeInTheDocument();
  });
});
