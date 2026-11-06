import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn(), applyAuthPayload: vi.fn() }),
}));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { SidebarNav } from '../SidebarNav';
import { TopHeader } from '../TopHeader';
import { BottomNav } from '../BottomNav';
import { AppDrawer } from '../AppDrawer';
import { PageHeader } from '../PageHeader';

function sessao(extra: Partial<ReturnType<typeof useAuthStore.getState>> = {}) {
  useAuthStore.setState({
    roleName: 'ADMIN',
    organizationName: 'Studio JS',
    fullName: null,
    permissions: [],
    ...extra,
  });
}

function semSombra(root: Element) {
  const comSombra = Array.from(root.querySelectorAll('*')).filter((el) =>
    /(^|\s|:)shadow/.test(el.getAttribute('class') ?? ''),
  );
  expect(comSombra).toHaveLength(0);
}

describe('casco Gestor Beauty: menu lateral (D-15)', () => {
  beforeEach(() => sessao());

  function renderSidebar() {
    return render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SidebarNav />
      </MemoryRouter>,
    );
  }

  it('mostra a marca do estúdio, 256 px, branco com borda e item ativo roxo', () => {
    renderSidebar();
    const marca = screen.getByTestId('sidebar-brand');
    expect(within(marca).getByText('JS')).toBeInTheDocument();
    expect(within(marca).getByText('Studio JS')).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(nav).toHaveClass('w-64', 'bg-white', 'border-r', 'border-neutral-200');

    const inicio = within(nav).getByRole('link', { name: 'Início' });
    expect(inicio).toHaveClass('bg-primary', 'text-white', 'min-h-[44px]');

    const agenda = within(nav).getByRole('button', { name: 'Agenda' });
    expect(agenda).toHaveAttribute('aria-expanded', 'true');
    expect(agenda).toHaveAttribute('aria-label', 'Agenda');
    expect(agenda).toHaveClass('uppercase');

    semSombra(nav);
  });

  it('rodapé com o nome da usuária, o papel embaixo e o botão Sair de 44 px', () => {
    sessao({ fullName: 'maria silva' });
    renderSidebar();
    const rodape = screen.getByTestId('sidebar-user');
    expect(within(rodape).getByText('Maria Silva')).toBeInTheDocument();
    expect(within(rodape).getByText('Admin')).toBeInTheDocument();
    expect(within(rodape).getByRole('button', { name: 'Sair' })).toHaveClass('h-11', 'w-11');
  });

  it('sessão antiga sem fullName mostra só o papel', () => {
    renderSidebar();
    const rodape = screen.getByTestId('sidebar-user');
    expect(within(rodape).getByText('Admin')).toBeInTheDocument();
    expect(within(rodape).queryByText('Maria Silva')).toBeNull();
  });
});

describe('casco Gestor Beauty: topo (D-16)', () => {
  beforeEach(() => {
    sessao();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('data por extenso, uma busca, sem blocos falsos, branco com borda', () => {
    const { container } = render(
      <MockedProvider mocks={[]}>
        <MemoryRouter>
          <TopHeader />
        </MemoryRouter>
      </MockedProvider>,
    );
    expect(screen.getByTestId('top-date')).toHaveTextContent(
      'Quinta-feira, 12 de novembro de 2026',
    );
    expect(screen.getAllByRole('button', { name: 'Buscar páginas no SGS' })).toHaveLength(1);
    for (const texto of ['Assine agora', 'Studio Beleza LTDA', 'Ajuda', 'Tutoriais']) {
      expect(screen.queryByText(texto)).toBeNull();
      expect(screen.queryByRole('button', { name: texto })).toBeNull();
    }
    const header = container.querySelector('header');
    expect(header).toHaveClass('h-14', 'bg-white', 'border-b', 'border-neutral-200');
    semSombra(header!);
  });
});

describe('casco Gestor Beauty: barra inferior do celular (D-17)', () => {
  beforeEach(() => sessao());

  function renderBottom(rota = '/agenda') {
    return render(
      <MemoryRouter initialEntries={[rota]}>
        <BottomNav onOpenMenu={() => undefined} />
      </MemoryRouter>,
    );
  }

  it('Agenda, Comanda, Clientes, Noivas e Mais, nesta ordem, 48 px e sem sombra', () => {
    renderBottom();
    const nav = screen.getByTestId('bottom-nav');
    const itens = Array.from(nav.children).map((el) => el.textContent);
    expect(itens).toEqual(['Agenda', 'Comanda', 'Clientes', 'Noivas', 'Mais']);
    expect(within(nav).getByRole('button', { name: 'Mais' })).toBeInTheDocument();
    for (const nome of ['Início', 'Notificações', 'Menu']) {
      expect(within(nav).queryByRole('link', { name: nome })).toBeNull();
      expect(within(nav).queryByRole('button', { name: nome })).toBeNull();
    }
    for (const el of Array.from(nav.children)) expect(el).toHaveClass('min-h-[48px]');
    expect(nav).toHaveClass('bg-white', 'border-t', 'border-neutral-200');
    semSombra(nav);
    expect(nav.className).not.toMatch(/shadow/);
  });

  it('profissional não vê Noivas', () => {
    sessao({ roleName: 'PROFESSIONAL' });
    renderBottom();
    const nav = screen.getByTestId('bottom-nav');
    expect(within(nav).queryByRole('link', { name: 'Noivas' })).toBeNull();
    for (const nome of ['Agenda', 'Comanda', 'Clientes']) {
      expect(within(nav).getByRole('link', { name: nome })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('button', { name: 'Mais' })).toBeInTheDocument();
  });

  it('Comanda fica ativa nas subrotas', () => {
    renderBottom('/comanda/abc');
    expect(screen.getByRole('link', { name: 'Comanda' })).toHaveClass('text-primary-500');
    expect(screen.getByRole('link', { name: 'Agenda' })).not.toHaveClass('text-primary-500');
  });
});

describe('casco Gestor Beauty: gaveta "Mais" (D-17, D-02)', () => {
  beforeEach(() => sessao({ fullName: 'maria silva' }));

  it('marca real, sem "Trocar estabelecimento", com Notificações, Início e rodapé', () => {
    const onOpenChange = vi.fn();
    const onOpenNotifications = vi.fn();
    render(
      <MemoryRouter>
        <AppDrawer
          open
          onOpenChange={onOpenChange}
          onOpenNotifications={onOpenNotifications}
        />
      </MemoryRouter>,
    );
    const gaveta = screen.getByRole('dialog');
    expect(within(gaveta).getByText('Studio JS')).toBeInTheDocument();
    expect(within(gaveta).queryByText(/Trocar estabelecimento/)).toBeNull();
    expect(within(gaveta).queryByText(/Studio Beleza/)).toBeNull();

    const inicio = within(gaveta).getByRole('link', { name: 'Início' });
    expect(inicio).toHaveClass('min-h-[44px]');

    expect(within(gaveta).getByText('Maria Silva')).toBeInTheDocument();
    expect(within(gaveta).getByText('Admin')).toBeInTheDocument();

    fireEvent.click(within(gaveta).getByRole('button', { name: 'Notificações' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });
});

describe('casco Gestor Beauty: PageHeader (D-13)', () => {
  it('h1 em serifa, ações quebrando no celular e trilha sem maiúsculas', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader
          title="Maria Silva"
          breadcrumbs={[{ label: 'Clientes', to: '/clientes' }, { label: 'Maria Silva' }]}
          cta={<button type="button">Editar</button>}
        />
      </MemoryRouter>,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass('font-serif', 'text-headline-lg', 'text-neutral-800');
    expect(h1.parentElement).toHaveClass('flex-col', 'sm:flex-row');
    expect(screen.getByRole('button', { name: 'Editar' }).parentElement).toHaveClass('flex-wrap');

    const trilha = container.querySelector('nav[aria-label="breadcrumb"]')!;
    expect(within(trilha as HTMLElement).getByRole('link', { name: 'Clientes' })).toHaveClass(
      'text-[12px]',
    );
    const atual = within(trilha as HTMLElement).getByText('Maria Silva', { exact: true });
    expect(atual).toHaveClass('text-[12px]');
    expect(atual.textContent).toBe('Maria Silva');
    const todos = [trilha, ...Array.from(trilha.querySelectorAll('*'))];
    for (const el of todos) expect(el.getAttribute('class') ?? '').not.toMatch(/uppercase/);
  });
});
