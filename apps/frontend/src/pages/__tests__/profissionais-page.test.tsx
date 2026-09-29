import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';
import { ProfissionaisPage } from '../ProfissionaisPage';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { AllMembersQuery } from '@/features/catalog/api/members.api';
import { CategoriesQuery } from '@/features/catalog/api/categorias.api';
import type { AdminMemberData } from '@/features/catalog/api/members.api';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

const members: AdminMemberData[] = [
  {
    id: 'mem-1',
    displayName: 'Ana Silva',
    email: 'ana@studio.com',
    roleName: 'PROFESSIONAL',
    seniorityTier: 'senior',
    isProfessional: true,
    status: 'active',
    phone: '+5511987654321',
    pixKey: '12345678909',
    birthDate: null,
    categories: [
      { id: 'cat-1', name: 'Cabelo' },
      { id: 'cat-2', name: 'Maquiagem' },
    ],
  },
  {
    id: 'mem-2',
    displayName: 'Bruno Souza',
    email: 'bruno@studio.com',
    roleName: 'ATTENDANT',
    seniorityTier: null,
    isProfessional: false,
    status: 'inactive',
    phone: null,
    pixKey: null,
    birthDate: null,
    categories: [],
  },
];

function membersMock(data: AdminMemberData[] = members) {
  return {
    request: { query: AllMembersQuery },
    result: { data: { allMembers: data } },
  };
}

const categoriesMock = {
  request: { query: CategoriesQuery },
  result: { data: { categories: [] } },
};

function renderPage(mocks = [membersMock(), categoriesMock]) {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <ProfissionaisPage />
    </MockedProvider>,
  );
}

/**
 * jsdom has no PointerEvent constructor, so `fireEvent.pointerDown` falls
 * back to a plain `Event` whose `button`/`ctrlKey` properties are dropped —
 * Radix's DropdownMenuTrigger checks `event.button === 0` before opening, so
 * a plain click/pointerDown never opens the menu here. Build the event by
 * hand and set the properties it needs before dispatching it.
 */
function openDropdown(trigger: HTMLElement) {
  const event = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'button', { value: 0 });
  Object.defineProperty(event, 'ctrlKey', { value: false });
  fireEvent(trigger, event);
}

describe('ProfissionaisPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN' });
  });

  afterEach(() => {
    useAuthStore.setState({ roleName: null });
  });

  describe('acoes por papel', () => {
    it('ADMIN ve Cadastrar profissional e a coluna de acoes dos membros', async () => {
      renderPage();
      await screen.findByText('Ana Silva');

      expect(
        screen.getByRole('button', { name: 'Cadastrar profissional' }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Ações' })).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'Convidar profissional' })).toBeNull();
    });

    it('MANAGER ve Cadastrar profissional, mas nao as acoes de membros', async () => {
      useAuthStore.setState({ roleName: 'MANAGER' });
      renderPage();
      await screen.findByText('Ana Silva');

      expect(
        screen.getByRole('button', { name: 'Cadastrar profissional' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ações' })).toBeNull();
      const membersTable = screen.getByText('Ana Silva').closest('table')!;
      expect(
        within(membersTable).queryByRole('columnheader', { name: 'Ações' }),
      ).toBeNull();
    });

    it.each(['ATTENDANT', 'PROFESSIONAL'])(
      '%s nao ve nenhuma acao, mas a lista continua legivel',
      async (role) => {
        useAuthStore.setState({ roleName: role });
        renderPage();
        await screen.findByText('Ana Silva');

        expect(
          screen.queryByRole('button', { name: 'Cadastrar profissional' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Ações' })).toBeNull();
        expect(screen.queryByRole('columnheader', { name: 'Ações' })).toBeNull();
      },
    );

    it('ATTENDANT no empty state ve a mensagem sem CTA de cadastro', async () => {
      useAuthStore.setState({ roleName: 'ATTENDANT' });
      renderPage([membersMock([]), categoriesMock]);

      expect(
        await screen.findByText('Nenhum profissional cadastrado'),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Cadastrar profissional' }),
      ).toBeNull();
    });
  });

  it('renders name, email, phone, role, category chips and status; no seniority column', async () => {
    renderPage();

    const anaRow = (await screen.findByText('Ana Silva')).closest('tr')!;
    expect(within(anaRow).getByText('ana@studio.com')).toBeInTheDocument();
    expect(within(anaRow).getByText('(11) 98765-4321')).toBeInTheDocument();
    // Role cell text AND the "Profissional" badge both render this label.
    expect(within(anaRow).getAllByText('Profissional').length).toBeGreaterThanOrEqual(2);
    expect(within(anaRow).getByText('Cabelo')).toBeInTheDocument();
    expect(within(anaRow).getByText('Maquiagem')).toBeInTheDocument();
    expect(within(anaRow).queryByText('Sênior')).toBeNull();
    expect(within(anaRow).getByText('Ativo')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Senioridade' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Telefone' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Categorias' })).toBeInTheDocument();

    const brunoRow = screen.getByText('Bruno Souza').closest('tr')!;
    expect(within(brunoRow).getByText('bruno@studio.com')).toBeInTheDocument();
    expect(within(brunoRow).getByText('Atendente')).toBeInTheDocument();
    expect(within(brunoRow).getByText('Inativo')).toBeInTheDocument();
  });

  it('shows "—" for a member without phone or categories, not undefined or empty', async () => {
    renderPage();
    await screen.findByText('Bruno Souza');
    const row = screen.getByText('Bruno Souza').closest('tr')!;
    expect(row).toHaveTextContent('—');
    expect(row).not.toHaveTextContent('undefined');
  });

  it('does not render pending invitations nor an invite button', async () => {
    renderPage();
    await screen.findByText('Ana Silva');
    expect(screen.queryByText('Convites pendentes')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Revogar' })).toBeNull();
  });

  it('offers Reativar for inactive members and Desativar for active members, plus reset for ADMIN', async () => {
    renderPage();
    await screen.findByText('Ana Silva');

    const activeRow = screen.getByText('Ana Silva').closest('tr')!;
    openDropdown(within(activeRow).getByRole('button', { name: 'Ações' }));
    expect(await screen.findByText('Desativar')).toBeInTheDocument();
    expect(screen.getByText('Gerar nova senha provisória')).toBeInTheDocument();
    expect(screen.queryByText('Reativar')).toBeNull();

    // Close menu by pressing Escape, then open the inactive member's menu
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    const inactiveRow = screen.getByText('Bruno Souza').closest('tr')!;
    openDropdown(within(inactiveRow).getByRole('button', { name: 'Ações' }));
    expect(await screen.findByText('Reativar')).toBeInTheDocument();
    expect(screen.queryByText('Desativar')).toBeNull();
  });

  it('shows an empty state with a register CTA when there are no members', async () => {
    renderPage([membersMock([]), categoriesMock]);

    expect(
      await screen.findByText('Nenhum profissional cadastrado'),
    ).toBeInTheDocument();
    // Header CTA + empty-state CTA both read "Cadastrar profissional".
    expect(
      screen.getAllByRole('button', { name: 'Cadastrar profissional' }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('opens CreateMemberDialog from the header CTA', async () => {
    renderPage();
    await screen.findByText('Ana Silva');

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar profissional' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Cadastrar profissional' }),
      ).toBeInTheDocument();
    });
  });
});
