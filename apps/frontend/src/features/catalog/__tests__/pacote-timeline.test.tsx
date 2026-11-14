import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n/index';
import { PackageTimelineDialog } from '../components/PackageTimelineDialog';
import { PackageTimelineQuery, SetPackageTimelineMutation } from '../api/package-timeline.api';
import type { PackageData } from '../api/pacotes.api';

const PKG_ID = '99999999-9999-4999-8999-999999999999';
const MAKE = '11111111-1111-4111-8111-111111111111';
const PENTEADO = '22222222-2222-4222-8222-222222222222';

const pkg = {
  id: PKG_ID,
  name: 'Glam',
  price: '3000.00',
  individualSum: '3500.00',
  services: [
    { serviceId: MAKE, quantity: 1, displayOrder: 0, includesTrial: false, service: { id: MAKE, name: 'Make noiva', basePrice: '500' } },
    { serviceId: PENTEADO, quantity: 1, displayOrder: 1, includesTrial: false, service: { id: PENTEADO, name: 'Penteado noiva', basePrice: '500' } },
  ],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
} as unknown as PackageData;

type Step = {
  id: string;
  displayOrder: number;
  isExtra: boolean;
  name: string;
  offsetMinutes: number;
  kind: 'make' | 'hair' | null;
  serviceId: string | null;
  durationMinutes: number | null;
  startsRegistry: boolean;
};

const step = (order: number, name: string, offset: number, extra: Partial<Step> = {}): Step => ({
  id: `s-${order}`,
  displayOrder: order,
  isExtra: false,
  name,
  offsetMinutes: offset,
  kind: null,
  serviceId: null,
  durationMinutes: null,
  startsRegistry: false,
  ...extra,
});

const GLAM: Step[] = [
  step(0, 'chegada - coffee', 450),
  step(1, 'make', 270, { kind: 'make', serviceId: MAKE, durationMinutes: 90 }),
  step(2, 'penteado', 180, { kind: 'hair', serviceId: PENTEADO, durationMinutes: 90 }),
  step(3, 'vestir', 120),
  step(4, 'fotos', 90, { startsRegistry: true }),
  step(5, 'fotos externas', 45),
  step(6, 'saída', 0),
  step(7, 'Chegada fotógrafos', 110, { isExtra: true }),
];

function setup(
  steps: Step[],
  opts: { saveSpy?: ReturnType<typeof vi.fn>; saveResult?: unknown; variables?: unknown } = {},
) {
  const onOpenChange = vi.fn();
  const mocks: unknown[] = [
    {
      request: { query: PackageTimelineQuery, variables: { packageId: PKG_ID } },
      result: { data: { packageTimeline: steps } },
      maxUsageCount: 5,
    },
  ];
  if (opts.variables) {
    mocks.push({
      request: { query: SetPackageTimelineMutation, variables: opts.variables },
      result: () => {
        opts.saveSpy?.();
        return { data: { setPackageTimeline: opts.saveResult } };
      },
    });
  }
  render(
    <MockedProvider mocks={mocks as never} addTypename={false}>
      <PackageTimelineDialog pkg={pkg} open onOpenChange={onOpenChange} />
    </MockedProvider>,
  );
  return { onOpenChange };
}

const preview = () => screen.getByTestId('timeline-rule-preview');

describe('PackageTimelineDialog', () => {
  it('carrega o GLAM com 7 etapas, 1 extra e a prévia das 17:00', async () => {
    setup(GLAM);
    await screen.findByLabelText('Etapa 7');
    expect(screen.queryByLabelText('Etapa 8')).toBeNull();
    expect(screen.getByLabelText('Texto do extra 1')).toHaveValue('Chegada fotógrafos');
    const p = within(preview());
    expect(p.getByText('09:30 chegada - coffee')).toBeInTheDocument();
    expect(p.getByText('12:30 make')).toBeInTheDocument();
    expect(p.getByText('15:30 fotos')).toBeInTheDocument();
    expect(p.getByText('17h saída')).toBeInTheDocument();
    expect(p.getByText('15:10 Chegada fotógrafos')).toBeInTheDocument();
  });

  it('atualiza a prévia ao mudar os minutos da etapa', async () => {
    setup(GLAM);
    const input = await screen.findByLabelText('Minutos antes da saída da etapa 2');
    fireEvent.change(input, { target: { value: '240' } });
    await waitFor(() => expect(within(preview()).getByText('13h make')).toBeInTheDocument());
  });

  it('só deixa um início do registro marcado', async () => {
    setup(GLAM);
    const fotos = await screen.findByLabelText(/Início do registro.*etapa 5/);
    const vestir = screen.getByLabelText(/Início do registro.*etapa 4/);
    expect(fotos).toBeChecked();
    fireEvent.click(vestir);
    await waitFor(() => expect(vestir).toBeChecked());
    expect(fotos).not.toBeChecked();
  });

  it('mostra o serviço do pacote e duração 90 ao escolher Make da noiva', async () => {
    setup(GLAM);
    expect(screen.queryByLabelText('Serviço da etapa 4')).toBeNull();
    const tipo = await screen.findByLabelText('Tipo da etapa 4');
    fireEvent.change(tipo, { target: { value: 'make' } });
    const servico = await screen.findByLabelText('Serviço da etapa 4');
    expect(within(servico).getByText('Make noiva')).toBeInTheDocument();
    expect(within(servico).getByText('Penteado noiva')).toBeInTheDocument();
    expect(screen.getByLabelText('Duração (min) da etapa 4')).toHaveValue(90);
  });

  it('salva etapas e depois extras, com duração 90 e registro só em fotos', async () => {
    const saveSpy = vi.fn();
    const expectedSteps = [...GLAM.filter((s) => !s.isExtra), ...GLAM.filter((s) => s.isExtra)].map(
      (s) => ({
        isExtra: s.isExtra,
        name: s.name,
        offsetMinutes: s.offsetMinutes,
        kind: s.kind,
        serviceId: s.serviceId,
        durationMinutes: s.durationMinutes,
        startsRegistry: s.startsRegistry,
      }),
    );
    const { onOpenChange } = setup(GLAM, {
      saveSpy,
      variables: { input: { packageId: PKG_ID, steps: expectedSteps } },
      saveResult: { steps: GLAM, errors: [] },
    });
    await screen.findByLabelText('Etapa 7');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cronograma' }));
    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('mostra o erro do servidor em alerta e mantém o diálogo aberto', async () => {
    const saveSpy = vi.fn();
    const same = GLAM.filter((s) => !s.isExtra)
      .concat(GLAM.filter((s) => s.isExtra))
      .map((s) => ({
        isExtra: s.isExtra,
        name: s.name,
        offsetMinutes: s.offsetMinutes,
        kind: s.kind,
        serviceId: s.serviceId,
        durationMinutes: s.durationMinutes,
        startsRegistry: s.startsRegistry,
      }));
    const { onOpenChange } = setup(GLAM, {
      saveSpy,
      variables: { input: { packageId: PKG_ID, steps: same } },
      saveResult: {
        steps: [],
        errors: [
          {
            code: 'TIMELINE_REGISTRY_REQUIRED',
            message: 'Marque a etapa que inicia o registro.',
            field: 'startsRegistry',
          },
        ],
      },
    });
    await screen.findByLabelText('Etapa 7');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cronograma' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Marque a etapa que inicia o registro.');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('mostra o estado vazio quando o pacote não tem regra', async () => {
    setup([]);
    expect(
      await screen.findByText(/Este pacote ainda não tem cronograma\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover cronograma' })).toBeNull();
  });
});
