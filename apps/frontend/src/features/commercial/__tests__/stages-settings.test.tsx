import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { CommercialStagesQuery } from '../api/leads.api';
import {
  CreateCommercialStageMutation,
  DeleteCommercialStageMutation,
  ReorderCommercialStagesMutation,
} from '../api/stages.api';
import { StagesSettingsTab } from '../components/StagesSettingsTab';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function stage(
  id: string,
  name: string,
  position: number,
  kind: string,
  slaDays: number | null,
  openDeals = 0,
) {
  return {
    __typename: 'CommercialStage',
    id,
    name,
    color: '#3b82f6',
    position,
    slaDays,
    kind,
    isSystem: kind !== 'open',
    openDeals,
  };
}

const STAGES = [
  stage('a', 'Novo', 0, 'open', 1, 2),
  stage('b', 'Contato', 1, 'open', 2),
  stage('c', 'Proposta', 2, 'open', 3),
  stage('w', 'Ganho', 3, 'won', null),
  stage('l', 'Perdido', 4, 'lost', null),
];

const stagesMock = (list = STAGES): MockedResponse => ({
  request: { query: CommercialStagesQuery },
  maxUsageCount: 10,
  result: { data: { commercialStages: list } },
});

function renderTab(extra: MockedResponse[] = [], list = STAGES) {
  render(
    <MockedProvider mocks={[stagesMock(list), ...extra]}>
      <StagesSettingsTab />
    </MockedProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('StagesSettingsTab', () => {
  it('lista as etapas; Ganho e Perdido são de sistema, sem prazo e sem excluir', async () => {
    renderTab();
    await screen.findByTestId('stage-row-a');
    const ganho = screen.getByTestId('stage-row-w');
    expect(within(ganho).getByText('Etapa de sistema')).toBeTruthy();
    expect(within(ganho).queryByText('Prazo (dias)')).toBeNull();
    expect(within(ganho).queryByRole('button', { name: /Excluir/ })).toBeNull();
    const novo = screen.getByTestId('stage-row-a');
    expect((within(novo).getByLabelText('Prazo (dias)') as HTMLInputElement).value).toBe('1');
    expect(within(novo).getByRole('button', { name: 'Excluir etapa Novo' })).toBeTruthy();
  });

  it('Nova etapa exige nome e chama createCommercialStage', async () => {
    const sent: Record<string, unknown>[] = [];
    renderTab([
      {
        request: { query: CreateCommercialStageMutation },
        variableMatcher: (v) => {
          sent.push(v as Record<string, unknown>);
          return true;
        },
        result: {
          data: {
            createCommercialStage: {
              __typename: 'CommercialStagePayload',
              stage: stage('n', 'Visita', 5, 'open', 4),
              errors: [],
            },
          },
        },
      },
    ]);
    await screen.findByTestId('stage-row-a');
    const botao = screen.getByRole('button', { name: 'Nova etapa' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Nome da nova etapa'), { target: { value: 'Visita' } });
    fireEvent.change(screen.getByLabelText('Prazo da nova etapa (dias)'), {
      target: { value: '4' },
    });
    fireEvent.click(botao);
    await waitFor(() =>
      expect(sent).toEqual([{ input: { name: 'Visita', color: '#3b82f6', slaDays: 4 } }]),
    );
  });

  it('descer reordena só entre as abertas com todos os ids e Ganho/Perdido no fim', async () => {
    const sent: Record<string, unknown>[] = [];
    renderTab([
      {
        request: { query: ReorderCommercialStagesMutation },
        variableMatcher: (v) => {
          sent.push(v as Record<string, unknown>);
          return true;
        },
        result: {
          data: {
            reorderCommercialStages: {
              __typename: 'CommercialStagesPayload',
              stages: STAGES,
              errors: [],
            },
          },
        },
      },
    ]);
    await screen.findByTestId('stage-row-a');
    fireEvent.click(screen.getByRole('button', { name: 'Descer Novo' }));
    await waitFor(() => expect(sent).toEqual([{ ids: ['b', 'a', 'c', 'w', 'l'] }]));
    expect(screen.getByRole('button', { name: 'Subir Novo' })).toBeTruthy();
  });

  it('excluir etapa com negócios pede o destino e chama deleteCommercialStage', async () => {
    const sent: Record<string, unknown>[] = [];
    renderTab([
      {
        request: { query: DeleteCommercialStageMutation },
        variableMatcher: (v) => {
          sent.push(v as Record<string, unknown>);
          return true;
        },
        result: {
          data: {
            deleteCommercialStage: { __typename: 'CommercialOkPayload', ok: true, errors: [] },
          },
        },
      },
    ]);
    await screen.findByTestId('stage-row-a');
    fireEvent.click(screen.getByRole('button', { name: 'Excluir etapa Novo' }));
    const select = (await screen.findByLabelText('Mover os negócios para')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'c' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir etapa' }));
    await waitFor(() => expect(sent).toEqual([{ id: 'a', moveToStageId: 'c' }]));
  });

  it('STAGE_LAST_OPEN aparece como mensagem amigável', async () => {
    renderTab(
      [
        {
          request: { query: DeleteCommercialStageMutation },
          variableMatcher: () => true,
          result: {
            data: {
              deleteCommercialStage: {
                __typename: 'CommercialOkPayload',
                ok: false,
                errors: [
                  {
                    __typename: 'UserError',
                    code: 'STAGE_LAST_OPEN',
                    message: 'texto técnico',
                    field: null,
                  },
                ],
              },
            },
          },
        },
      ],
      [stage('a', 'Novo', 0, 'open', 1), stage('b', 'Contato', 1, 'open', 2), STAGES[3]!, STAGES[4]!],
    );
    await screen.findByTestId('stage-row-a');
    fireEvent.click(screen.getByRole('button', { name: 'Excluir etapa Novo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir etapa' }));
    expect(await screen.findByText('Mantenha pelo menos uma etapa aberta.')).toBeTruthy();
  });
});
