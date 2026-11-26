import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import type { MockedResponse } from '@apollo/client/testing';
import '@/infrastructure/i18n';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { AllMembersQuery } from '@/features/catalog/api/members.api';
import type { AdminMemberData } from '@/features/catalog/api/members.api';
import { MemberAccessOverviewQuery, MemberAccessQuery } from '../access-admin.api';
import { PerfisAcessoPage } from '../pages/PerfisAcessoPage';

function member(
  id: string,
  displayName: string,
  roleName: string,
  status = 'active',
): AdminMemberData {
  return {
    id,
    displayName,
    email: `${id}@t.com`,
    roleName,
    seniorityTier: null,
    isProfessional: false,
    isBridalAssistant: false,
    isFixed: false,
    servesBridal: false,
    status,
    phone: null,
    pixKey: null,
    birthDate: null,
    categories: [],
  } as AdminMemberData;
}

const mocks: MockedResponse[] = [
  {
    request: { query: AllMembersQuery },
    result: {
      data: {
        allMembers: [
          member('m1', 'Renata Dona', 'ADMIN'),
          member('m2', 'Bruno Souza', 'ATTENDANT'),
          member('m3', 'Érica Lima', 'PROFESSIONAL'),
          member('m4', 'Carlos Inativo', 'ATTENDANT', 'inactive'),
        ],
      },
    },
  },
  {
    request: { query: MemberAccessOverviewQuery },
    result: {
      data: {
        memberAccessOverview: [
          { memberId: 'm2', adjustedCount: 2 },
          { memberId: 'm3', adjustedCount: 0 },
        ],
      },
    },
  },
  {
    request: { query: MemberAccessQuery, variables: { memberId: 'm2' } },
    result: {
      data: {
        memberAccess: {
          memberId: 'm2',
          displayName: 'Bruno Souza',
          roleName: 'ATTENDANT',
          editable: true,
          lockReason: null,
          adjustedCount: 2,
          items: [
            {
              id: 'agenda',
              label: 'Agenda',
              group: 'operacao',
              groupLabel: 'Operação',
              enabled: true,
              defaultEnabled: true,
              source: 'DEFAULT',
              adjustable: true,
              lockReason: null,
              permissions: [],
            },
          ],
        },
      },
    },
  },
];

function renderPage() {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <PerfisAcessoPage />
    </MockedProvider>,
  );
}

afterEach(() => useAuthStore.setState({ memberId: null }));

describe('PerfisAcessoPage', () => {
  it('lista só pessoas ativas com papel e quantidade de ajustes', async () => {
    useAuthStore.setState({ memberId: 'm1' });
    renderPage();
    expect(await screen.findByText('Bruno Souza')).toBeInTheDocument();
    expect(screen.queryByText('Carlos Inativo')).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId('perfil-member-m2')).toHaveTextContent('2 ajustes'),
    );
    expect(screen.getByTestId('perfil-member-m2')).toHaveTextContent('Atendente');
    expect(screen.getByTestId('perfil-member-m3')).toHaveTextContent('Sem ajustes');
    expect(screen.getByTestId('perfil-member-m1')).toHaveTextContent('Você');
  });

  it('busca por nome ignora acento e caixa', async () => {
    renderPage();
    await screen.findByText('Bruno Souza');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar pessoa' }), {
      target: { value: 'erica' },
    });
    expect(screen.getByText('Érica Lima')).toBeInTheDocument();
    expect(screen.queryByText('Bruno Souza')).toBeNull();
  });

  it('clicar numa pessoa abre o painel de acessos dela', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('perfil-member-m2'));
    expect(await screen.findByTestId('member-access-panel')).toBeInTheDocument();
    expect(screen.getByTestId('perfil-member-m2')).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByRole('switch', { name: 'Agenda' })).toBeInTheDocument();
  });
});
