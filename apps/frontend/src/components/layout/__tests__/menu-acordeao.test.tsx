import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import '@/infrastructure/i18n';

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn(), applyAuthPayload: vi.fn() }),
}));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { SidebarNav } from '../SidebarNav';
import { AppDrawer } from '../AppDrawer';

// Quick 261107-j9q: menu lateral e gaveta em acordeão — abrir um menu com submenus fecha o
// irmão que estava aberto, em todos os níveis.

function botao(nav: HTMLElement, nome: string) {
  return within(nav).getByRole('button', { name: nome });
}

function IrPara({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      ir {to}
    </button>
  );
}

function renderSidebar(rota: string, props: { lowStockCount?: number } = {}) {
  useAuthStore.setState({ roleName: 'ADMIN', organizationName: 'Studio JS' });
  render(
    <MemoryRouter initialEntries={[rota]}>
      <SidebarNav {...props} />
      <IrPara to="/financeiro/previsao" />
    </MemoryRouter>,
  );
  return screen.getByRole('navigation', { name: 'Navegação principal' });
}

describe('menu lateral em acordeão', () => {
  it('abrir um grupo fecha o irmão aberto e clicar no aberto fecha', () => {
    const nav = renderSidebar('/dashboard');
    fireEvent.click(botao(nav, 'Eventos'));
    expect(botao(nav, 'Eventos')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(botao(nav, 'Financeiro'));
    expect(botao(nav, 'Financeiro')).toHaveAttribute('aria-expanded', 'true');
    expect(botao(nav, 'Eventos')).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('link', { name: 'Contratos' })).toBeNull();

    fireEvent.click(botao(nav, 'Financeiro'));
    expect(botao(nav, 'Financeiro')).toHaveAttribute('aria-expanded', 'false');
    expect(botao(nav, 'Eventos')).toHaveAttribute('aria-expanded', 'false');
  });

  it('vale também para os submenus de um mesmo grupo', () => {
    const nav = renderSidebar('/dashboard');
    fireEvent.click(botao(nav, 'Meu Estabelecimento'));
    fireEvent.click(botao(nav, 'Clientes'));
    expect(within(nav).getByRole('link', { name: 'Todos os clientes' })).toBeInTheDocument();

    fireEvent.click(botao(nav, 'Profissionais'));
    expect(botao(nav, 'Profissionais')).toHaveAttribute('aria-expanded', 'true');
    expect(botao(nav, 'Clientes')).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('link', { name: 'Todos os clientes' })).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Todos os profissionais' })).toBeInTheDocument();
  });

  it('nasce aberto só o ramo da rota atual', () => {
    const nav = renderSidebar('/clientes');
    expect(botao(nav, 'Meu Estabelecimento')).toHaveAttribute('aria-expanded', 'true');
    expect(botao(nav, 'Clientes')).toHaveAttribute('aria-expanded', 'true');
    expect(botao(nav, 'Profissionais')).toHaveAttribute('aria-expanded', 'false');
    expect(botao(nav, 'Eventos')).toHaveAttribute('aria-expanded', 'false');
    expect(botao(nav, 'Financeiro')).toHaveAttribute('aria-expanded', 'false');
  });

  it('acompanha a rota quando ela muda para outro ramo', () => {
    const nav = renderSidebar('/clientes');
    fireEvent.click(screen.getByRole('button', { name: 'ir /financeiro/previsao' }));
    expect(botao(nav, 'Financeiro')).toHaveAttribute('aria-expanded', 'true');
    expect(botao(nav, 'Meu Estabelecimento')).toHaveAttribute('aria-expanded', 'false');
  });

  it('o aviso de estoque baixo aparece no grupo fechado que contém Produtos', () => {
    const nav = renderSidebar('/dashboard', { lowStockCount: 2 });
    const grupo = botao(nav, 'Meu Estabelecimento');
    expect(grupo).toHaveAttribute('aria-expanded', 'false');
    expect(within(grupo).getByLabelText(/2 produto/)).toBeInTheDocument();
  });
});

describe('gaveta do celular em acordeão', () => {
  function renderGaveta(rota: string) {
    useAuthStore.setState({ roleName: 'ADMIN', organizationName: 'Studio JS' });
    render(
      <MemoryRouter initialEntries={[rota]}>
        <AppDrawer open onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    return screen.getByRole('navigation', { name: 'Menu principal' });
  }

  it('fora de qualquer ramo abre Meu Estabelecimento; abrir outro fecha ele', () => {
    const nav = renderGaveta('/dashboard');
    expect(botao(nav, 'Meu Estabelecimento')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(botao(nav, 'Financeiro'));
    expect(botao(nav, 'Financeiro')).toHaveAttribute('aria-expanded', 'true');
    expect(botao(nav, 'Meu Estabelecimento')).toHaveAttribute('aria-expanded', 'false');
  });

  it('nos submenus, abrir um fecha o irmão', () => {
    const nav = renderGaveta('/clientes');
    expect(botao(nav, 'Clientes')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(botao(nav, 'Serviços'));
    expect(botao(nav, 'Serviços')).toHaveAttribute('aria-expanded', 'true');
    expect(botao(nav, 'Clientes')).toHaveAttribute('aria-expanded', 'false');
  });
});

// Quick 261107-jvl: todo item do menu tem ícone, inclusive os grupos do topo e as folhas.
// Quick 261107-k9c: Agenda é item direto, sem submenu.
describe('Agenda sem submenu', () => {
  it('é um link para /agenda no topo, sem botão de abrir', () => {
    const nav = renderSidebar('/agenda');
    const agenda = within(nav).getByRole('link', { name: 'Agenda' });
    expect(agenda).toHaveAttribute('href', '/agenda');
    expect(agenda).toHaveAttribute('aria-current', 'page');
    expect(agenda).toHaveClass('bg-primary-50', 'text-primary-900');
    expect(within(nav).queryByRole('button', { name: 'Agenda' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Minha agenda' })).toBeNull();
  });
});

describe('ícone em todos os itens do menu', () => {
  it('cada botão e link do menu lateral, com tudo aberto, mostra um ícone', () => {
    const nav = renderSidebar('/dashboard');
    // Abre um ramo por vez (acordeão) e confere cada item visível.
    const conferir = () =>
      within(nav)
        .getAllByRole('link')
        .concat(within(nav).getAllByRole('button').filter((b) => b.hasAttribute('aria-expanded')))
        .forEach((el) => {
          if (el.getAttribute('data-testid') === 'sidebar-brand') return;
          expect(el.querySelector('svg'), el.getAttribute('aria-label') ?? '').not.toBeNull();
        });
    conferir();
    const grupos = within(nav)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-expanded') === 'false');
    for (const g of grupos) {
      fireEvent.click(g);
      conferir();
      within(nav)
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-expanded') === 'false')
        .forEach((sub) => {
          fireEvent.click(sub);
          conferir();
        });
    }
  });
});
