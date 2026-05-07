import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/infrastructure/i18n';
import { CpfDuplicateAlert } from '../components/CpfDuplicateAlert';
import type { DuplicateClient } from '../components/CpfDuplicateAlert';

function renderAlert(clients: DuplicateClient[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <CpfDuplicateAlert clients={clients} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('CpfDuplicateAlert', () => {
  it('renders nothing when clients array is empty', () => {
    const { container } = renderAlert([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders 2 list items when 2 clients are passed', () => {
    const clients: DuplicateClient[] = [
      { id: 'id-1', fullName: 'Ana Silva', phone: '(11) 99999-9999' },
      { id: 'id-2', fullName: 'Ana M. Silva', email: 'ana@email.com' },
    ];
    renderAlert(clients);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Ana M. Silva')).toBeInTheDocument();
  });

  it('each item has a "Usar este cliente" link pointing to /clientes/{id}', () => {
    const clients: DuplicateClient[] = [
      { id: 'abc-123', fullName: 'Maria Souza', phone: '(21) 88888-8888' },
    ];
    renderAlert(clients);
    const links = screen.getAllByRole('link');
    // Both the name link and the "Usar este cliente" link should point to /clientes/abc-123
    const clientLinks = links.filter((l: HTMLElement) =>
      l.getAttribute('href')?.includes('/clientes/abc-123'),
    );
    expect(clientLinks.length).toBeGreaterThanOrEqual(1);
    // "Usar este cliente" text link
    expect(
      screen.getByText('[Usar este cliente]'),
    ).toBeInTheDocument();
  });
});
