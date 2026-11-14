import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { PackagesQuery } from '@/features/catalog/api/pacotes.api';
import { ProfessionalsForServiceQuery } from '@/features/operations/api/appointments.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  BridalTimelinePreviewQuery,
  BridalTimelineQuery,
  ConfirmBridalTimelineMutation,
  type BridalTimelineData,
  type BridalTimelinePreviewData,
} from '../api/timeline.api';
import { BridalTimelineTab } from '../components/BridalTimelineTab';
import { group, member } from './bridal-fixtures';

const g = group({
  id: 'g1',
  packageId: 'pk1',
  packageName: 'Glam',
  readyBy: '2026-11-08T20:00:00Z',
  members: [member({ id: 'm1', role: 'bride', clientName: 'Vitória Souza' })],
});

/** Acrescenta __typename a todo objeto (o cliente real recebe isso do servidor). */
function withTypes<T>(value: T, name = 'Obj'): T {
  if (Array.isArray(value)) return value.map((v) => withTypes(v, name)) as T;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = { __typename: o.__typename ?? name };
    for (const [k, v] of Object.entries(o)) if (k !== '__typename') out[k] = withTypes(v, name);
    return out as T;
  }
  return value;
}

const GLAM_TEXT = 'GLAM 17h - VITÓRIA\n\nChegada fotógrafos: 15:10\n17:00 Saída';

const pkgMock: MockedResponse = {
  request: { query: PackagesQuery },
  maxUsageCount: 50,
  result: withTypes({
    data: {
      packages: [
        {
          id: 'pk1',
          name: 'Glam',
          price: 0,
          individualSum: 0,
          validForDays: null,
          depositKind: null,
          depositValue: null,
          contractDescription: null,
          coverImageUrl: null,
          services: [],
          costItems: [],
          totalCost: 0,
          profit: 0,
          profitPercent: 0,
          createdAt: '2026-11-01T12:00:00.000Z',
          updatedAt: '2026-11-01T12:00:00.000Z',
        },
      ],
    },
  }),
};

const profsMock: MockedResponse = {
  request: { query: ProfessionalsForServiceQuery },
  variableMatcher: () => true,
  maxUsageCount: 50,
  result: withTypes({
    data: {
      professionalsForService: [{ id: 'p1', displayName: 'Paula' }],
    },
  }),
};

function row(time: string, name: string) {
  return {
    __typename: 'BridalTimelineRow',
    time,
    minutes: 0,
    name,
    label: null,
    kind: 'step',
    professionalName: null,
    isExtra: false,
    isRegistry: false,
  };
}

function preview(p: Partial<BridalTimelinePreviewData> = {}): BridalTimelinePreviewData {
  return {
    groupId: 'g1',
    packageId: 'pk1',
    packageName: 'Glam',
    departureTime: '17:00',
    brideLabel: 'VITÓRIA',
    makeProfessionalId: null,
    hairProfessionalId: null,
    rows: [row('15:10', 'Chegada fotógrafos'), row('17:00', 'Saída')],
    text: GLAM_TEXT,
    warnings: [],
    registryStartsAt: null,
    brideSlots: [
      {
        kind: 'make',
        stepName: 'Make da noiva',
        serviceId: 'sv-make',
        serviceName: 'Maquiagem',
        professionalId: null,
        professionalName: null,
        startsAt: '2026-11-08T16:30:00Z',
        endsAt: '2026-11-08T18:00:00Z',
      },
    ],
    conflicts: [],
    missing: [],
    canConfirm: true,
    ...p,
  };
}

function official(p: Partial<BridalTimelineData> = {}): BridalTimelineData {
  return {
    id: 't1',
    groupId: 'g1',
    packageId: 'pk1',
    packageName: 'Glam',
    departureTime: '17:00',
    brideLabel: 'VITÓRIA',
    makeProfessionalId: 'p1',
    hairProfessionalId: null,
    rows: [row('17:00', 'Saída')],
    text: GLAM_TEXT,
    warnings: [],
    registryStartsAt: null,
    registryLabel: null,
    confirmedAt: '2026-11-08T12:00:00Z',
    confirmedByName: 'Joana Gerente',
    version: 3,
    companionIssues: [],
    ...p,
  };
}

function officialMock(t: BridalTimelineData | null | (() => BridalTimelineData | null)): MockedResponse {
  return {
    request: { query: BridalTimelineQuery },
    variableMatcher: () => true,
    maxUsageCount: 50,
    result: () => ({
      data: withTypes({ bridalTimeline: typeof t === 'function' ? t() : t }),
    }),
  };
}

function previewMock(
  results: BridalTimelinePreviewData[],
  onVars?: (v: unknown) => void,
  errors: { code: string; message: string; field: string | null }[] = [],
): MockedResponse {
  let i = 0;
  return {
    request: { query: BridalTimelinePreviewQuery },
    variableMatcher: (v) => {
      onVars?.(v);
      return true;
    },
    maxUsageCount: 20,
    result: () => {
      const pv = errors.length ? null : results[Math.min(i, results.length - 1)];
      i += 1;
      return { data: withTypes({ bridalTimelinePreview: { preview: pv, errors } }) };
    },
  };
}

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  useAuthStore.setState({ roleName: 'MANAGER' });
});

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

function renderTab(mocks: MockedResponse[], onChanged = () => undefined) {
  return render(
    <MockedProvider mocks={[pkgMock, profsMock, ...mocks]}>
      <BridalTimelineTab group={g} onChanged={onChanged} />
    </MockedProvider>,
  );
}

async function generate() {
  const btn = screen.getByTestId('timeline-generate');
  await waitFor(() => expect(btn).toBeEnabled());
  fireEvent.click(btn);
}

describe('BridalTimelineTab', () => {
  it('sem cronograma oficial, preenche saída e nome no título', async () => {
    renderTab([officialMock(null)]);
    expect(await screen.findByText(/Ainda não há cronograma confirmado/)).toBeInTheDocument();
    expect(screen.getByTestId('timeline-departure')).toHaveValue('17:00');
    expect(screen.getByTestId('timeline-label')).toHaveValue('VITÓRIA');
    await waitFor(() => expect(screen.getByTestId('timeline-package')).toHaveValue('pk1'));
  });

  it('gera a simulação com as variáveis exatas e mostra o texto', async () => {
    const vars: unknown[] = [];
    renderTab([officialMock(null), previewMock([preview()], (v) => vars.push(v))]);
    await generate();
    expect(await screen.findByTestId('timeline-text')).toHaveTextContent(
      'Chegada fotógrafos: 15:10',
    );
    expect(vars[0]).toEqual({
      input: {
        groupId: 'g1',
        packageId: 'pk1',
        departureTime: '17:00',
        brideLabel: 'VITÓRIA',
        makeProfessionalId: null,
        hairProfessionalId: null,
      },
    });
  });

  it('mantém duas simulações e "Descartar" remove uma', async () => {
    renderTab([
      officialMock(null),
      previewMock([preview(), preview({ departureTime: '17:30', text: 'GLAM 17h30' })]),
    ]);
    await generate();
    await screen.findByTestId('timeline-sim-0');
    fireEvent.change(screen.getByTestId('timeline-departure'), { target: { value: '17:30' } });
    await waitFor(() => expect(screen.getByTestId('timeline-generate')).toBeEnabled());
    fireEvent.click(screen.getByTestId('timeline-generate'));
    await waitFor(() => expect(screen.getAllByTestId('timeline-text')).toHaveLength(2));
    expect(screen.getByText(/Simulação 2 — Glam, saída 17:30/)).toBeInTheDocument();
    expect(screen.getByText(/Simulação 1 — Glam, saída 17:00/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Descartar' })[0]);
    await waitFor(() => expect(screen.getAllByTestId('timeline-text')).toHaveLength(1));
    expect(screen.getByTestId('timeline-text')).toHaveTextContent('Chegada fotógrafos: 15:10');
  });

  it('"Copiar texto" copia o texto exato da simulação', async () => {
    renderTab([officialMock(null), previewMock([preview()])]);
    await generate();
    await screen.findByTestId('timeline-text');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar texto' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(GLAM_TEXT));
  });

  it('simulação incompleta desabilita a confirmação e lista o que falta', async () => {
    renderTab([
      officialMock(null),
      previewMock([
        preview({
          canConfirm: false,
          missing: ['Escolha a profissional de make.'],
          warnings: [{ code: 'PROFESSIONAL_UNDEFINED', message: 'Profissional a definir' }],
        }),
      ]),
    ]);
    await generate();
    await screen.findByTestId('timeline-missing');
    expect(screen.getByText('Escolha a profissional de make.')).toBeInTheDocument();
    expect(screen.getByText('Profissional a definir')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar (ok do studio)' })).toBeDisabled();
  });

  it('mostra o aviso de chegada antes das 06h', async () => {
    renderTab([
      officialMock(null),
      previewMock([
        preview({ warnings: [{ code: 'ARRIVAL_BEFORE_06', message: 'Chegada às 05:30' }] }),
      ]),
    ]);
    await generate();
    expect(await screen.findByText('Chegada antes das 06h')).toBeInTheDocument();
  });

  it('depois da primeira simulação oferece as profissionais, sem pré-seleção', async () => {
    renderTab([officialMock(null), previewMock([preview()])]);
    expect(screen.queryByTestId('timeline-make')).not.toBeInTheDocument();
    await generate();
    const make = await screen.findByTestId('timeline-make');
    expect(make).toHaveValue('');
    expect(make.querySelector('option')).toHaveTextContent('[a definir]');
    await waitFor(() => expect(make.querySelectorAll('option').length).toBe(2));
  });

  it('confirma com as variáveis da simulação e mostra o cronograma oficial', async () => {
    let sent: unknown = null;
    let confirmed = false;
    const changed = vi.fn();
    renderTab(
      [
        officialMock(() => (confirmed ? official() : null)),
        previewMock([preview()]),
        {
          request: { query: ConfirmBridalTimelineMutation },
          variableMatcher: (v) => {
            sent = v;
            return true;
          },
          result: () => {
            confirmed = true;
            return {
              data: withTypes({
                confirmBridalTimeline: { timeline: official(), conflicts: [], errors: [] },
              }),
            };
          },
        },
      ],
      changed,
    );
    await generate();
    await screen.findByTestId('timeline-text');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar (ok do studio)' }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(sent).toEqual({
      input: {
        groupId: 'g1',
        packageId: 'pk1',
        departureTime: '17:00',
        brideLabel: 'VITÓRIA',
        makeProfessionalId: null,
        hairProfessionalId: null,
      },
    });
    expect(await screen.findByTestId('timeline-official-meta')).toHaveTextContent('Versão 3');
    expect(screen.getByTestId('timeline-official-meta')).toHaveTextContent('Joana Gerente');
  });

  it('cronograma oficial com acompanhantes que não cabem mostra o aviso', async () => {
    renderTab([
      officialMock(
        official({
          companionIssues: [
            {
              appointmentId: 'a1',
              clientName: 'Bia Acompanhante',
              professionalName: 'Paula',
              serviceName: 'Penteado',
              startsAt: '2026-11-08T17:30:00Z',
              endsAt: '2026-11-08T18:30:00Z',
              rule: 'TIMELINE_AFTER_REGISTRY',
              message: 'Termina depois do registro.',
            },
          ],
        }),
      ),
    ]);
    expect(
      await screen.findByText('Acompanhantes que não cabem mais no cronograma'),
    ).toBeInTheDocument();
    expect(screen.getByText('Bia Acompanhante')).toBeInTheDocument();
    expect(screen.getByText('Termina depois do início do registro')).toBeInTheDocument();
  });

  it('erro TIMELINE_RULES_MISSING mostra a mensagem de configurar o pacote', async () => {
    renderTab([
      officialMock(null),
      previewMock([], undefined, [
        { code: 'TIMELINE_RULES_MISSING', message: 'sem regras', field: null },
      ]),
    ]);
    await generate();
    expect(await screen.findByTestId('timeline-form-error')).toHaveTextContent(
      'Este pacote não tem cronograma configurado',
    );
  });

  it('papel PROFESSIONAL não consegue confirmar', async () => {
    useAuthStore.setState({ roleName: 'PROFESSIONAL' });
    renderTab([officialMock(null), previewMock([preview()])]);
    await generate();
    await screen.findByTestId('timeline-text');
    expect(screen.getByRole('button', { name: 'Confirmar (ok do studio)' })).toBeDisabled();
  });
});
