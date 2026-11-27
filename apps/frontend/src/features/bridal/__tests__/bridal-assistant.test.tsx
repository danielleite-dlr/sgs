import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  BridalAssistantCandidatesQuery,
  BridalGroupQuery,
  BridalGroupsQuery,
  SetBridalGroupAssistantMutation,
  UpdateBridalGroupMutation,
  type BridalGroupData,
} from '../api/bridal.api';
import { ContractPackagesQuery } from '../api/contracts.api';
import { BridalGroupFormDialog } from '../components/BridalGroupFormDialog';
import { BridalGroupDetailPage } from '../pages/BridalGroupDetailPage';
import { BridalGroupsPage } from '../pages/BridalGroupsPage';
import { group } from './bridal-fixtures';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const pendingGroup = group({
  id: 'g1',
  name: 'Casamento Ana',
  assistantRequired: true,
  assistantPending: true,
});
const linkedGroup = group({
  id: 'g1',
  name: 'Casamento Ana',
  assistantRequired: true,
  assistantPending: false,
  assistantMemberId: 'a1',
  assistantName: 'Assistente A',
  assistantDailyRate: '220.00',
});

function queryMock(g: BridalGroupData): MockedResponse {
  return {
    request: { query: BridalGroupQuery },
    variableMatcher: () => true,
    maxUsageCount: 20,
    result: { data: { bridalGroup: g } },
  };
}
const servicesMock: MockedResponse = {
  request: { query: ServicesQuery },
  variableMatcher: () => true,
  maxUsageCount: 50,
  result: { data: { services: [] } },
};
const packagesMock: MockedResponse = {
  request: { query: ContractPackagesQuery },
  maxUsageCount: 20,
  result: { data: { packages: [] } },
};

const candidatesMock: MockedResponse = {
  request: { query: BridalAssistantCandidatesQuery },
  variableMatcher: () => true,
  result: {
    data: {
      bridalAssistantCandidates: [
        {
          __typename: 'BridalAssistantCandidate',
          memberId: 'a1',
          displayName: 'Assistente A',
          available: true,
          reason: null,
          current: false,
        },
        {
          __typename: 'BridalAssistantCandidate',
          memberId: 'a2',
          displayName: 'Assistente B',
          available: false,
          reason: 'Tem atendimento neste dia',
          current: false,
        },
      ],
    },
  },
};

function setPayload(
  g: BridalGroupData | null,
  opts: { warning?: string | null; errors?: { code: string; message: string }[] } = {},
) {
  return {
    data: {
      setBridalGroupAssistant: {
        __typename: 'BridalGroupPayload',
        group: g,
        warning: opts.warning ?? null,
        errors: (opts.errors ?? []).map((e) => ({
          __typename: 'UserError',
          field: null,
          ...e,
        })),
      },
    },
  };
}

function renderDetail(g: BridalGroupData, extra: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={[queryMock(g), servicesMock, ...extra]}>
      <MemoryRouter initialEntries={['/noivas/g1']}>
        <Routes>
          <Route path="/noivas/:id" element={<BridalGroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('Assistente da noiva (09.1)', () => {
  it("grupo de debutante mostra 'Assistente da debutante'", async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    renderDetail(
      group({
        id: 'g1',
        name: 'Debutante Lia',
        eventKind: 'debutante',
        assistantRequired: true,
        assistantPending: true,
      }),
      [candidatesMock],
    );
    expect(
      await screen.findByRole('region', { name: 'Assistente da debutante' }),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId('assistant-choose'));
    expect(await screen.findByText('Escolher assistente da debutante')).toBeInTheDocument();
  });

  it('pendente: ATTENDANT vê o aviso com botão; PROFESSIONAL vê só o aviso', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    const { unmount } = renderDetail(pendingGroup);
    expect(await screen.findByText('Sem assistente — escolher')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-choose')).toBeInTheDocument();
    unmount();
    useAuthStore.setState({ roleName: 'PROFESSIONAL' });
    renderDetail(pendingGroup);
    expect(await screen.findByTestId('assistant-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-choose')).not.toBeInTheDocument();
  });

  it('escolhe a assistente: ocupada desabilitada com motivo e vínculo enviado', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    let sent: { groupId: string; memberId: string | null } | null = null;
    renderDetail(pendingGroup, [
      candidatesMock,
      {
        request: { query: SetBridalGroupAssistantMutation },
        variableMatcher: (v) => {
          sent = v as typeof sent;
          return true;
        },
        result: setPayload(linkedGroup),
      },
    ]);
    fireEvent.click(await screen.findByTestId('assistant-choose'));
    const b = await screen.findByTestId('candidate-a2');
    expect(b).toBeDisabled();
    expect(screen.getByText('Tem atendimento neste dia')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('candidate-a1'));
    fireEvent.click(screen.getByTestId('assistant-confirm'));
    await waitFor(() =>
      expect(screen.getByTestId('assistant-name')).toHaveTextContent('Assistente: Assistente A'),
    );
    expect(sent).toEqual({ groupId: 'g1', memberId: 'a1' });
    expect(toast.success).toHaveBeenCalledWith('Assistente vinculada.');
  });

  it('erro ASSISTANT_BUSY vira toast de erro com a mensagem', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    renderDetail(pendingGroup, [
      candidatesMock,
      {
        request: { query: SetBridalGroupAssistantMutation },
        variableMatcher: () => true,
        result: setPayload(null, {
          errors: [{ code: 'ASSISTANT_BUSY', message: 'Assistente A está ocupada neste dia.' }],
        }),
      },
    ]);
    fireEvent.click(await screen.findByTestId('assistant-choose'));
    fireEvent.click(await screen.findByTestId('candidate-a1'));
    fireEvent.click(screen.getByTestId('assistant-confirm'));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Assistente A está ocupada neste dia.'),
    );
  });

  it('diária aparece para MANAGER e não para ATTENDANT', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    const { unmount } = renderDetail(linkedGroup);
    expect(await screen.findByTestId('assistant-rate')).toHaveTextContent('R$ 220,00');
    unmount();
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    renderDetail({ ...linkedGroup, assistantDailyRate: null });
    expect(await screen.findByTestId('assistant-name')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-rate')).not.toBeInTheDocument();
    expect(screen.getByTestId('assistant-change')).toBeInTheDocument();
  });

  it('PROFESSIONAL vê o nome sem botões', async () => {
    useAuthStore.setState({ roleName: 'PROFESSIONAL' });
    renderDetail(linkedGroup);
    expect(await screen.findByTestId('assistant-name')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-change')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assistant-remove')).not.toBeInTheDocument();
  });

  it('remover envia memberId nulo', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    let sent: { groupId: string; memberId: string | null } | null = null;
    renderDetail(linkedGroup, [
      {
        request: { query: SetBridalGroupAssistantMutation },
        variableMatcher: (v) => {
          sent = v as typeof sent;
          return true;
        },
        result: setPayload({
          ...linkedGroup,
          assistantPending: true,
          assistantMemberId: null,
          assistantName: null,
          assistantDailyRate: null,
        }),
      },
    ]);
    fireEvent.click(await screen.findByTestId('assistant-remove'));
    fireEvent.click(await screen.findByTestId('assistant-remove-confirm'));
    await waitFor(() => expect(screen.getByTestId('assistant-pending')).toBeInTheDocument());
    expect(sent).toEqual({ groupId: 'g1', memberId: null });
    expect(toast.success).toHaveBeenCalledWith('Assistente removida.');
  });

  it('grupo não elegível sem assistente não mostra o card', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderDetail(group({ id: 'g1', name: 'Casamento Ana', assistantRequired: false }));
    expect(await screen.findByTestId('bg-detail-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-card')).not.toBeInTheDocument();
  });

  it('lista: selo só no pendente e filtro "Sem assistente"', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    const g2 = group({ id: 'g2', name: 'Casamento Bia', assistantRequired: true });
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: BridalGroupsQuery },
            variableMatcher: () => true,
            maxUsageCount: 20,
            result: { data: { bridalGroups: [pendingGroup, g2] } },
          },
          servicesMock,
          packagesMock,
        ]}
      >
        <MemoryRouter initialEntries={['/noivas']}>
          <Routes>
            <Route path="/noivas" element={<BridalGroupsPage />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>,
    );
    await screen.findByText('Casamento Ana');
    expect(screen.getByTestId('badge-no-assistant-g1')).toBeInTheDocument();
    expect(screen.queryByTestId('badge-no-assistant-g2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('grp-no-assistant'));
    expect(screen.getByText('Casamento Ana')).toBeInTheDocument();
    expect(screen.queryByText('Casamento Bia')).not.toBeInTheDocument();
  });

  it('edição com warning mostra toast de aviso', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    const warning =
      'A assistente A foi removida e a agenda dela no dia foi liberada (evento fora do estúdio).';
    const g = group({ id: 'g1', name: 'Casamento Ana' });
    render(
      <MockedProvider
        mocks={[
          servicesMock,
          packagesMock,
          {
            request: { query: UpdateBridalGroupMutation },
            variableMatcher: () => true,
            result: {
              data: {
                updateBridalGroup: { __typename: 'BridalGroupPayload', group: g, warning, errors: [] },
              },
            },
          },
        ]}
      >
        <BridalGroupFormDialog open onOpenChange={() => {}} group={g} onSaved={() => {}} />
      </MockedProvider>,
    );
    fireEvent.click(await screen.findByTestId('bg-submit'));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(warning));
    expect(toast.success).toHaveBeenCalledWith('Grupo atualizado.');
  });
});
