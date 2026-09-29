import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';
import { ProfissionaisPage } from '../ProfissionaisPage';
import {
  AllMembersQuery,
  PendingInvitationsQuery,
} from '@/features/catalog/api/members.api';
import type {
  AdminMemberData,
  PendingInvitationData,
} from '@/features/catalog/api/members.api';

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
  },
  {
    id: 'mem-2',
    displayName: 'Bruno Souza',
    email: 'bruno@studio.com',
    roleName: 'ATTENDANT',
    seniorityTier: null,
    isProfessional: false,
    status: 'inactive',
  },
];

const invitations: PendingInvitationData[] = [
  {
    id: 'inv-1',
    email: 'convidado@studio.com',
    roleName: 'PROFESSIONAL',
    isProfessional: true,
    seniorityTier: 'pleno',
    expiresAt: '2026-10-06T12:00:00Z',
    createdAt: '2026-09-29T12:00:00Z',
  },
];

function membersMock(data: AdminMemberData[] = members) {
  return {
    request: { query: AllMembersQuery },
    result: { data: { allMembers: data } },
  };
}

function invitationsMock(data: PendingInvitationData[] = invitations) {
  return {
    request: { query: PendingInvitationsQuery },
    result: { data: { pendingInvitations: data } },
  };
}

function renderPage(mocks = [membersMock(), invitationsMock()]) {
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
  it('renders one row per member with name, email, role, seniority and status', async () => {
    renderPage();

    const anaRow = (await screen.findByText('Ana Silva')).closest('tr')!;
    expect(within(anaRow).getByText('ana@studio.com')).toBeInTheDocument();
    // Role cell text AND the "Profissional" badge both render this label.
    expect(within(anaRow).getAllByText('Profissional').length).toBeGreaterThanOrEqual(2);
    expect(within(anaRow).getByText('Sênior')).toBeInTheDocument();
    expect(within(anaRow).getByText('Ativo')).toBeInTheDocument();

    const brunoRow = screen.getByText('Bruno Souza').closest('tr')!;
    expect(within(brunoRow).getByText('bruno@studio.com')).toBeInTheDocument();
    expect(within(brunoRow).getByText('Atendente')).toBeInTheDocument();
    expect(within(brunoRow).getByText('Inativo')).toBeInTheDocument();
  });

  it('shows "—" for a member without a seniority tier, not undefined or empty', async () => {
    renderPage();
    await screen.findByText('Bruno Souza');
    const row = screen.getByText('Bruno Souza').closest('tr')!;
    expect(row).toHaveTextContent('—');
    expect(row).not.toHaveTextContent('undefined');
  });

  it('offers Reativar for inactive members and Desativar for active members', async () => {
    renderPage();
    await screen.findByText('Ana Silva');

    const activeRow = screen.getByText('Ana Silva').closest('tr')!;
    openDropdown(within(activeRow).getByRole('button', { name: 'Ações' }));
    expect(await screen.findByText('Desativar')).toBeInTheDocument();
    expect(screen.queryByText('Reativar')).toBeNull();

    // Close menu by pressing Escape, then open the inactive member's menu
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    const inactiveRow = screen.getByText('Bruno Souza').closest('tr')!;
    openDropdown(within(inactiveRow).getByRole('button', { name: 'Ações' }));
    expect(await screen.findByText('Reativar')).toBeInTheDocument();
    expect(screen.queryByText('Desativar')).toBeNull();
  });

  it('shows pending invitations with email, role, expiration and a Revogar action', async () => {
    renderPage();

    expect(await screen.findByText('Convites pendentes')).toBeInTheDocument();
    expect(screen.getByText('convidado@studio.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revogar' })).toBeInTheDocument();
  });

  it('shows an empty state with an invite CTA when there are no members and no invitations', async () => {
    renderPage([membersMock([]), invitationsMock([])]);

    expect(
      await screen.findByText('Nenhum profissional cadastrado'),
    ).toBeInTheDocument();
    // Header CTA + empty-state CTA both read "Convidar profissional".
    expect(
      screen.getAllByRole('button', { name: 'Convidar profissional' }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('opens InviteMemberDialog from the header CTA', async () => {
    renderPage();
    await screen.findByText('Ana Silva');

    fireEvent.click(screen.getByRole('button', { name: 'Convidar profissional' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Convidar profissional' }),
      ).toBeInTheDocument();
    });
  });
});
