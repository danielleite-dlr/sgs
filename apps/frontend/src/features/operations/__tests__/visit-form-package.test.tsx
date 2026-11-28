import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { ClientsListQuery } from '@/features/clients/api/clients.api';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { SuggestProfessionalsQuery } from '../api/professional-suggestion.api';
import {
  CreateVisitMutation,
  ProfessionalsForServiceQuery,
  VisitPackagesQuery,
} from '../api/appointments.api';
import { VisitFormDialog } from '../components/calendar/VisitFormDialog';
import type { ScheduleProfessional } from '../components/calendar/types';

// Fase 12, plano 03: pacote dentro da linha de serviço (D-01..D-07, D-10, D-12).

function service(id: string, name: string, basePrice: string, minutes: number) {
  return {
    __typename: 'Service',
    id,
    name,
    categoryId: 'cat',
    category: { __typename: 'ServiceCategory', id: 'cat', name: 'Maquiagem', parentId: null },
    basePrice,
    defaultDurationMinutes: minutes,
    displayOrder: 1,
    coverImageUrl: null,
    pricingVariants: [],
  };
}

function pkgService(id: string, name: string, order: number) {
  return {
    __typename: 'PackageService',
    serviceId: id,
    quantity: 1,
    displayOrder: order,
    service: { __typename: 'Service', id, name, defaultDurationMinutes: 60 },
  };
}

function pros(n: number): ScheduleProfessional[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Profissional ${i + 1}`,
    initials: `P${i + 1}`,
    color: '#7E22CE',
  }));
}

const captured: Record<string, unknown>[] = [];

function mocks(): MockedResponse[] {
  return [
    {
      request: { query: ClientsListQuery },
      variableMatcher: (v) => !!v.search,
      maxUsageCount: 50,
      result: {
        data: {
          clients: {
            __typename: 'ClientsPage',
            totalCount: 1,
            rows: [
              {
                __typename: 'Client',
                id: 'c1',
                fullName: 'Ana Social',
                phone: '11999990000',
                email: null,
                cpf: null,
                birthDate: null,
                address: null,
                rg: null,
                postalCode: null,
                phone2: null,
                phone3: null,
                notes: null,
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
              },
            ],
          },
        },
      },
    },
    {
      request: { query: ClientsListQuery },
      variableMatcher: (v) => !v.search,
      maxUsageCount: 50,
      result: { data: { clients: { __typename: 'ClientsPage', totalCount: 0, rows: [] } } },
    },
    {
      request: { query: ServicesQuery },
      variableMatcher: () => true,
      maxUsageCount: 50,
      result: {
        data: {
          services: [
            service('s-make', 'Maquiagem social', '220.00', 60),
            service('s-pent', 'Penteado', '160.00', 60),
            service('s-esc', 'Escova', '80.00', 60),
          ],
        },
      },
    },
    {
      request: { query: VisitPackagesQuery },
      variableMatcher: (v) => v.date === '2026-11-06',
      maxUsageCount: 50,
      result: {
        data: {
          packages: [
            {
              __typename: 'Package',
              id: 'pkg-mp',
              name: 'Make & Penteado',
              services: [pkgService('s-make', 'Maquiagem social', 0), pkgService('s-pent', 'Penteado', 1)],
            },
          ],
        },
      },
    },
    {
      request: { query: VisitPackagesQuery },
      variableMatcher: (v) => v.date === '2026-11-07',
      maxUsageCount: 50,
      result: { data: { packages: [] } },
    },
    {
      request: { query: ProfessionalsForServiceQuery },
      variableMatcher: () => true,
      maxUsageCount: 50,
      result: {
        data: {
          professionalsForService: ['p1', 'p2'].map((id) => ({
            __typename: 'Professional',
            id,
            displayName: id,
            isFixed: true,
          })),
        },
      },
    },
    {
      request: { query: SuggestProfessionalsQuery },
      variableMatcher: () => true,
      maxUsageCount: 50,
      result: { data: { suggestProfessionals: [] } },
    },
    {
      request: { query: CreateVisitMutation },
      variableMatcher: (v) => {
        captured.push(v);
        return true;
      },
      maxUsageCount: 10,
      result: { data: { createVisit: { appointments: [], comandaId: null, errors: [] } } },
    },
  ];
}

function renderDialog(initialTime?: { hour: number; minute: number; profId?: string }) {
  captured.length = 0;
  return render(
    <MockedProvider mocks={mocks()}>
      <VisitFormDialog
        open
        onOpenChange={() => undefined}
        date={new Date(2026, 10, 6)}
        professionals={pros(2)}
        initialTime={initialTime}
        onCreated={() => undefined}
      />
    </MockedProvider>,
  );
}

async function chooseService(line: number, id: string, time?: string) {
  await screen.findByRole('option', { name: 'Escova' });
  fireEvent.change(screen.getByTestId(`visit-line-${line}-service`), { target: { value: id } });
  if (time) fireEvent.change(screen.getByTestId(`visit-line-${line}-time`), { target: { value: time } });
}

async function choosePackage(user: ReturnType<typeof userEvent.setup>, line: number) {
  const kind = screen.getByTestId(`visit-line-${line}-kind-package`);
  await waitFor(() => expect(kind).toBeEnabled());
  await user.click(kind);
  const select = await screen.findByTestId(`visit-line-${line}-package`);
  await screen.findByRole('option', { name: 'Make & Penteado' });
  await user.selectOptions(select, 'pkg-mp');
}

const time = (i: number) => (screen.getByTestId(`visit-line-${i}-time`) as HTMLInputElement).value;

describe('D-01: seletor Serviço | Pacote por linha', () => {
  it('não existe mais o select de pacote no fim; cada linha tem o seletor de 44 px', () => {
    renderDialog();
    expect(screen.queryByTestId('visit-package')).toBeNull();
    for (const k of ['service', 'package']) {
      const btn = screen.getByTestId(`visit-line-0-kind-${k}`);
      expect(btn).toHaveAttribute('role', 'radio');
      expect(btn).toHaveClass('min-h-[44px]');
    }
  });
});

describe('D-12: Make & Penteado em sequência', () => {
  it('com hora na linha: 10:00 e 11:00, mesma profissional', async () => {
    const user = userEvent.setup();
    renderDialog({ hour: 10, minute: 0, profId: 'p1' });
    await choosePackage(user, 0);
    expect(time(0)).toBe('10:00');
    expect(time(1)).toBe('11:00');
    expect(screen.getByTestId('visit-line-0-service')).toHaveValue('s-make');
    expect(screen.getByTestId('visit-line-1-service')).toHaveValue('s-pent');
    expect(screen.getByTestId('visit-line-0-professional-p1')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('visit-line-1-professional-p1')).toHaveAttribute('aria-checked', 'true');
  });

  it('sem hora na linha: 09:00 e 10:00, nunca iguais', async () => {
    const user = userEvent.setup();
    renderDialog();
    await choosePackage(user, 0);
    expect(time(0)).toBe('09:00');
    expect(time(1)).toBe('10:00');
    expect(time(0)).not.toBe(time(1));
  });
});

describe('D-02/D-03: pacote no meio de avulsos, um por agendamento', () => {
  async function setup() {
    const user = userEvent.setup();
    renderDialog();
    await chooseService(0, 's-esc', '10:00');
    fireEvent.click(screen.getByTestId('visit-add-line'));
    await choosePackage(user, 1);
    return user;
  }

  it('linhas acima e abaixo ficam iguais; dá para adicionar avulso depois', async () => {
    await setup();
    expect(screen.getByTestId('visit-line-0-service')).toHaveValue('s-esc');
    expect(time(0)).toBe('10:00');
    expect(time(1)).toBe('11:00');
    expect(time(2)).toBe('12:00');
    fireEvent.click(screen.getByTestId('visit-add-line'));
    expect(screen.getByTestId('visit-line-3-service')).toHaveValue('');
    expect(screen.getByTestId('visit-line-3-kind-service')).toHaveAttribute('aria-checked', 'true');
  });

  it('com pacote escolhido, a opção Pacote fica desabilitada nas linhas avulsas', async () => {
    await setup();
    fireEvent.click(screen.getByTestId('visit-add-line'));
    expect(screen.getByTestId('visit-line-3-kind-package')).toBeDisabled();
    expect(screen.getByTestId('visit-line-0-kind-package')).toBeDisabled();
  });
});

describe('D-10/D-07: linhas do pacote', () => {
  it('selo, serviço travado, sem lixeira, um único Remover pacote; hora editável sem cascata', async () => {
    const user = userEvent.setup();
    renderDialog({ hour: 10, minute: 0, profId: 'p1' });
    await choosePackage(user, 0);
    for (const i of [0, 1]) {
      expect(screen.getByTestId(`visit-line-${i}-package-badge`)).toHaveTextContent(
        'do pacote Make & Penteado',
      );
      expect(screen.getByTestId(`visit-line-${i}-service`)).toBeDisabled();
      expect(screen.queryByRole('button', { name: `Remover serviço ${i + 1}` })).toBeNull();
    }
    expect(screen.getAllByTestId('visit-package-remove')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('visit-add-line'));
    fireEvent.change(screen.getByTestId('visit-line-2-time'), { target: { value: '15:00' } });
    fireEvent.change(screen.getByTestId('visit-line-0-time'), { target: { value: '09:30' } });
    expect(time(1)).toBe('11:00');
    expect(time(2)).toBe('15:00');
  });
});

describe('D-04: Remover pacote', () => {
  it('tira só as linhas do pacote e mantém os avulsos', async () => {
    const user = userEvent.setup();
    renderDialog();
    await chooseService(0, 's-esc', '10:00');
    fireEvent.click(screen.getByTestId('visit-add-line'));
    await choosePackage(user, 1);
    fireEvent.click(screen.getByTestId('visit-add-line'));
    fireEvent.change(screen.getByTestId('visit-line-3-service'), { target: { value: 's-esc' } });

    await user.click(screen.getByTestId('visit-package-remove'));
    expect(screen.queryByTestId('visit-line-0-package-badge')).toBeNull();
    expect(screen.queryByTestId('visit-package-remove')).toBeNull();
    expect(screen.getByTestId('visit-line-0-service')).toHaveValue('s-esc');
    expect(screen.getByTestId('visit-line-1-service')).toHaveValue('s-esc');
    expect(screen.queryByTestId('visit-line-2-service')).toBeNull();
    expect(screen.getByTestId('visit-line-0-kind-package')).toBeEnabled();
  });

  it('só o pacote: sobra uma linha vazia', async () => {
    const user = userEvent.setup();
    renderDialog({ hour: 10, minute: 0, profId: 'p1' });
    await choosePackage(user, 0);
    await user.click(screen.getByTestId('visit-package-remove'));
    expect(screen.queryByTestId('visit-line-1-service')).toBeNull();
    expect(screen.getByTestId('visit-line-0-service')).toHaveValue('');
  });
});

describe('D-05: pacote que deixa de valer na nova data', () => {
  it('tira o pacote e mantém os avulsos', async () => {
    const user = userEvent.setup();
    renderDialog();
    await chooseService(0, 's-esc', '10:00');
    fireEvent.click(screen.getByTestId('visit-add-line'));
    await choosePackage(user, 1);
    fireEvent.change(screen.getByTestId('visit-date'), { target: { value: '07/11/2026' } });
    await waitFor(() => expect(screen.queryByTestId('visit-line-1-package-badge')).toBeNull());
    expect(screen.getByTestId('visit-line-0-service')).toHaveValue('s-esc');
    expect(screen.queryByTestId('visit-line-1-service')).toBeNull();
  });
});

describe('Envio com pacote na linha', () => {
  async function pickClient(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByTestId('visit-client-search'), 'Ana');
    await user.click(await screen.findByTestId('visit-client-option-c1'));
  }

  it('manda um único packageId e as horas das linhas; depois de remover, null', async () => {
    const user = userEvent.setup();
    renderDialog({ hour: 10, minute: 0, profId: 'p1' });
    await pickClient(user);
    await choosePackage(user, 0);
    await user.click(screen.getByTestId('visit-submit'));
    await waitFor(() => expect(captured).toHaveLength(1));
    const input = captured[0].input as {
      packageId: string | null;
      items: { startsAt: string }[];
    };
    expect(input.packageId).toBe('pkg-mp');
    expect(input.items[1].startsAt).toBe(new Date(2026, 10, 6, 11, 0).toISOString());
  });

  it('remover o pacote e salvar manda packageId null', async () => {
    const user = userEvent.setup();
    renderDialog({ hour: 10, minute: 0, profId: 'p1' });
    await pickClient(user);
    await choosePackage(user, 0);
    await user.click(screen.getByTestId('visit-package-remove'));
    await chooseService(0, 's-esc');
    await user.click(screen.getByTestId('visit-submit'));
    await waitFor(() => expect(captured).toHaveLength(1));
    expect((captured[0].input as { packageId: string | null }).packageId).toBeNull();
  });

  it('linha em modo Pacote sem pacote escolhido mostra mensagem clara', async () => {
    const user = userEvent.setup();
    renderDialog({ hour: 10, minute: 0, profId: 'p1' });
    await pickClient(user);
    const kind = screen.getByTestId('visit-line-0-kind-package');
    await waitFor(() => expect(kind).toBeEnabled());
    await user.click(kind);
    await user.click(screen.getByTestId('visit-submit'));
    expect(await screen.findByTestId('visit-error')).toHaveTextContent(
      'Escolha o pacote ou volte para Serviço.',
    );
    expect(captured).toHaveLength(0);
  });
});
