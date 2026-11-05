import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  BridalGroupQuery,
  CreateBridalGroupMutation,
  type BridalGroupFieldsInput,
} from '../api/bridal.api';
import { ContractPackagesQuery } from '../api/contracts.api';
import { BridalGroupFormDialog } from '../components/BridalGroupFormDialog';
import { BridalGroupDetailPage } from '../pages/BridalGroupDetailPage';
import { debutanteGroup, group } from './bridal-fixtures';

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

type Sent = { input: { group: BridalGroupFieldsInput } } | null;

function renderDialog(opts: { errors?: { code: string; message: string }[] } = {}) {
  const state: { sent: Sent } = { sent: null };
  const created = group({ id: 'g9' });
  const create: MockedResponse = {
    request: { query: CreateBridalGroupMutation },
    variableMatcher: (v) => {
      state.sent = v as Sent;
      return true;
    },
    result: {
      data: {
        createBridalGroup: {
          __typename: 'BridalGroupPayload',
          group: opts.errors?.length ? null : created,
          errors: (opts.errors ?? []).map((e) => ({
            __typename: 'BridalUserError',
            ...e,
          })),
        },
      },
    },
  };
  const onSaved = vi.fn();
  render(
    <MockedProvider mocks={[servicesMock, packagesMock, create]}>
      <BridalGroupFormDialog open onOpenChange={() => {}} onSaved={onSaved} />
    </MockedProvider>,
  );
  return { state, onSaved };
}

function fillBase(person: string) {
  fireEvent.change(screen.getByTestId('bg-name'), {
    target: { value: 'Evento Teste' },
  });
  fireEvent.change(screen.getByTestId('bg-date'), {
    target: { value: '2026-12-20' },
  });
  fireEvent.change(screen.getByTestId('bride-name'), {
    target: { value: person },
  });
}

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('BridalGroupFormDialog (tipo, responsável, horário e local)', () => {
  it('cria noiva no estúdio sem local: eventKind noiva e locationName null', async () => {
    const { state, onSaved } = renderDialog();
    fillBase('Carol Souza');
    fireEvent.click(screen.getByTestId('bg-submit'));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    const g = state.sent!.input.group;
    expect(g.eventKind).toBe('noiva');
    expect(g.locationName).toBeNull();
    expect(g.locationAddress).toBeNull();
    expect(g.eventTime).toBeNull();
    expect(g).not.toHaveProperty('newResponsible');
    expect(screen.queryByText('Responsável (contratante)')).not.toBeInTheDocument();
  });

  it('Debutante mostra a responsável e envia newResponsible', async () => {
    const { state, onSaved } = renderDialog();
    fireEvent.click(screen.getByTestId('bg-kind-debutante'));
    expect(screen.getByText('Responsável (contratante)')).toBeInTheDocument();
    expect(screen.getByText('A responsável é quem assina o contrato.')).toBeInTheDocument();
    fillBase('Julia Debutante');
    fireEvent.change(screen.getByTestId('responsible-name'), {
      target: { value: 'Marta Souza' },
    });
    fireEvent.click(screen.getByTestId('bg-submit'));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    const g = state.sent!.input.group;
    expect(g.eventKind).toBe('debutante');
    expect(g.newResponsible).toEqual({ fullName: 'Marta Souza' });
  });

  it('envia horário do evento, nome do local e endereço', async () => {
    const { state, onSaved } = renderDialog();
    fillBase('Carol Souza');
    fireEvent.change(screen.getByTestId('group-event-time'), {
      target: { value: '16:00' },
    });
    fireEvent.change(screen.getByTestId('group-location-name'), {
      target: { value: 'Salão Aurora' },
    });
    fireEvent.change(screen.getByTestId('group-location-address'), {
      target: { value: 'Rua A, 10' },
    });
    fireEvent.click(screen.getByTestId('bg-submit'));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    const g = state.sent!.input.group;
    expect(g.eventTime).toBe('16:00');
    expect(g.locationName).toBe('Salão Aurora');
    expect(g.locationAddress).toBe('Rua A, 10');
  });

  it('exibe o erro RESPONSIBLE_IS_DEBUTANTE do backend', async () => {
    renderDialog({
      errors: [{ code: 'RESPONSIBLE_IS_DEBUTANTE', message: 'x' }],
    });
    fireEvent.click(screen.getByTestId('bg-kind-debutante'));
    fillBase('Julia');
    fireEvent.click(screen.getByTestId('bg-submit'));
    expect(
      await screen.findByText('A responsável não pode ser a própria debutante.'),
    ).toBeInTheDocument();
  });

  it('externo sem endereço bloqueia o envio', async () => {
    const { state } = renderDialog();
    fillBase('Carol');
    fireEvent.change(screen.getByTestId('bg-location'), {
      target: { value: 'external' },
    });
    fireEvent.click(screen.getByTestId('bg-submit'));
    expect(await screen.findByText('Informe o endereço do evento externo.')).toBeInTheDocument();
    expect(state.sent).toBeNull();
  });
});

describe('detalhe do grupo', () => {
  it('mostra tipo, responsável, horário e local', async () => {
    const g = debutanteGroup({ id: 'g1', name: 'Festa da Julia' });
    useAuthStore.setState({ roleName: 'MANAGER' });
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: BridalGroupQuery },
            variableMatcher: () => true,
            maxUsageCount: 20,
            result: { data: { bridalGroup: g } },
          },
          servicesMock,
        ]}
      >
        <MemoryRouter initialEntries={['/noivas/g1']}>
          <Routes>
            <Route path="/noivas/:id" element={<BridalGroupDetailPage />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>,
    );
    expect(await screen.findByTestId('bg-detail-kind')).toHaveTextContent('Debutante');
    expect(screen.getByTestId('bg-detail-responsible')).toHaveTextContent('Marta Souza');
    expect(screen.getByTestId('bg-detail-event-time')).toHaveTextContent('19:30');
    expect(screen.getByTestId('bg-detail-location-name')).toHaveTextContent('Salão Aurora');
    expect(screen.getByTestId('bg-detail-location-address')).toHaveTextContent(
      'Endereço do atendimento: Rua das Flores, 100',
    );
  });
});
