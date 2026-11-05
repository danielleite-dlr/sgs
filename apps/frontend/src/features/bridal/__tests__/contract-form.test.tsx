import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  ContractGroupQuery,
  ContractPackagesQuery,
  ContractServicesQuery,
  ContractSettingsQuery,
  CreateContractMutation,
  UpdateContractMutation,
  type ContractData,
} from '../api/contracts.api';
import { ContractFormDialog } from '../components/ContractFormDialog';
import {
  makeContract,
  makePackageContract,
  makeSettings,
  withTypenames,
} from './contract-fixtures';

type Vars = Record<string, unknown>;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const GROUP: MockedResponse = {
  request: { query: ContractGroupQuery, variables: { id: 'g1' } },
  result: {
    data: {
      bridalGroup: {
        __typename: 'BridalGroup',
        id: 'g1',
        name: 'Casamento Ana',
        eventDate: '2030-06-15',
        status: 'active',
        contractId: null,
        packageId: null,
        members: [
          {
            __typename: 'BridalGroupMember',
            id: 'm1',
            clientName: 'Ana Souza',
            role: 'bride',
            coveredByContract: true,
            services: [
              {
                __typename: 'BridalMemberService',
                id: 'ms1',
                serviceId: 's1',
                serviceName: 'Maquiagem noiva',
                purpose: 'event',
              },
            ],
          },
        ],
      },
    },
  },
};

const BASE_MOCKS: MockedResponse[] = [
  GROUP,
  {
    request: { query: ContractServicesQuery },
    result: {
      data: {
        services: [
          { __typename: 'Service', id: 's1', name: 'Maquiagem noiva', basePrice: '800.00' },
        ],
      },
    },
  },
  { request: { query: ContractPackagesQuery }, result: { data: { packages: [] } } },
  { request: { query: ContractSettingsQuery }, result: { data: { contractSettings: makeSettings() } } },
];

interface Captured {
  vars: Vars | null;
}

function createMock(captured: Captured, errors: unknown[] = []): MockedResponse {
  return {
    request: { query: CreateContractMutation },
    variableMatcher: (vars: Vars) => {
      captured.vars = vars;
      return true;
    },
    result: {
      data: {
        createContract: {
          __typename: 'ContractPayload',
          contract: null,
          errors,
        },
      },
    },
  };
}

function renderCreate(captured: Captured, errors: unknown[] = []) {
  return render(
    <MockedProvider mocks={[...BASE_MOCKS, createMock(captured, errors)]}>
      <MemoryRouter>
        <ContractFormDialog open onOpenChange={() => undefined} groupId="g1" />
      </MemoryRouter>
    </MockedProvider>,
  );
}

function renderEdit(contract: ContractData, captured: Captured, packages: unknown[] = []) {
  const mock: MockedResponse = {
    request: { query: UpdateContractMutation },
    variableMatcher: (vars: Vars) => {
      captured.vars = vars;
      return true;
    },
    result: {
      data: {
        updateContract: {
          __typename: 'ContractPayload',
          contract: withTypenames(contract),
          errors: [],
        },
      },
    },
  };
  return render(
    <MockedProvider
      mocks={[
        ...BASE_MOCKS.filter((m) => m.request.query !== ContractPackagesQuery),
        { request: { query: ContractPackagesQuery }, result: { data: { packages } } },
        mock,
      ]}
    >
      <MemoryRouter>
        <ContractFormDialog open onOpenChange={() => undefined} contract={contract} />
      </MemoryRouter>
    </MockedProvider>,
  );
}

const typeMoney = (label: string, digits: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: digits } });

describe('ContractFormDialog — forma de pagamento e parcelas', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'MANAGER', permissions: [] });
  });

  it('modo padrão Sinal envia 1 parcela com o valor do sinal e a data de hoje', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    expect(screen.getByLabelText('Sinal')).toBeChecked();
    typeMoney('Valor do sinal (R$)', '40000');
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.paymentMode).toBe('sinal');
    expect(input.installments).toEqual([{ dueDate: todayIso(), amount: '400.00' }]);
  });

  it('sinal parcelado: soma R$ 399,98 de R$ 400,00 bloqueia; R$ 399,99 libera', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    fireEvent.click(screen.getByLabelText('Sinal parcelado'));
    typeMoney('Valor do sinal (R$)', '40000');
    typeMoney('Valor da parcela 1', '30000');
    fireEvent.click(screen.getByRole('button', { name: /Adicionar parcela/ }));
    fireEvent.change(screen.getByLabelText('Vencimento da parcela 2'), {
      target: { value: '2030-02-01' },
    });
    typeMoney('Valor da parcela 2', '9998');
    expect(
      screen.getByText('A soma das parcelas (R$ 399,98) deve ser igual ao sinal (R$ 400,00).'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('contract-submit')).toBeDisabled();

    typeMoney('Valor da parcela 2', '9999');
    expect(screen.queryByTestId('installments-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('contract-submit')).toBeEnabled();
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.paymentMode).toBe('sinal_parcelado');
    expect(input.installments).toEqual([
      { dueDate: todayIso(), amount: '300.00' },
      { dueDate: '2030-02-01', amount: '99.99' },
    ]);
  });

  it('parcela sem data pede a data e bloqueia salvar; remover não deixa zerar', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    fireEvent.click(screen.getByLabelText('Sinal parcelado'));
    typeMoney('Valor do sinal (R$)', '40000');
    expect(screen.getByRole('button', { name: 'Remover parcela 1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar parcela/ }));
    expect(screen.getByText('Informe a data da parcela.')).toBeInTheDocument();
    expect(screen.getByTestId('contract-submit')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover parcela 2' }));
    expect(screen.queryByText('Informe a data da parcela.')).not.toBeInTheDocument();
    expect(screen.getByTestId('contract-submit')).toBeEnabled();
  });

  it('à vista: valor = total, sem Restante, envia a_vista', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    fireEvent.click(screen.getByLabelText('À vista'));
    expect(screen.getByLabelText('Valor do sinal (R$)')).toHaveValue('800,00');
    expect(screen.getByLabelText('Valor do sinal (R$)')).toHaveAttribute('readonly');
    expect(within(screen.getByTestId('contract-summary')).queryByText(/Restante/)).toBeNull();
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.paymentMode).toBe('a_vista');
    expect(input.installments).toEqual([{ dueDate: todayIso(), amount: '800.00' }]);
  });

  it('envia a descrição do desconto', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    typeMoney('Valor do sinal (R$)', '40000');
    fireEvent.change(screen.getByLabelText('Descrição do desconto'), {
      target: { value: '10% OFF' },
    });
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    expect(((captured.vars as Vars).input as Vars).discountDescription).toBe('10% OFF');
  });

  it('edição de contrato de pacote preserva packageItem e mostra a marca Pacote', async () => {
    const captured: Captured = { vars: null };
    renderEdit(makePackageContract(), captured);
    const items = await screen.findByTestId('contract-items');
    expect(within(items).getByText('Pacote')).toBeInTheDocument();
    expect(screen.getByLabelText('Sinal parcelado')).toBeChecked();
    expect(screen.getByLabelText('Descrição do desconto')).toHaveValue('10% OFF');
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as { items: Array<Vars>; installments: Vars[] };
    expect(input.items[0].packageItem).toBe(true);
    expect(input.installments).toHaveLength(2);
  });

  it('mostra o erro INSTALLMENTS_SUM_MISMATCH vindo do backend', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured, [
      {
        __typename: 'UserError',
        code: 'INSTALLMENTS_SUM_MISMATCH',
        message: 'A soma das parcelas deve ser igual ao valor do sinal.',
        field: 'installments',
      },
    ]);
    await screen.findByTestId('contract-items');
    typeMoney('Valor do sinal (R$)', '40000');
    fireEvent.click(screen.getByTestId('contract-submit'));
    expect(await screen.findByTestId('contract-form-error')).toHaveTextContent(
      'A soma das parcelas deve ser igual ao valor do sinal.',
    );
  });
});

function renderNew(captured: Captured, packages: unknown[] = []) {
  const mocks: MockedResponse[] = [
    ...BASE_MOCKS.filter((m) => m.request.query !== ContractPackagesQuery),
    { request: { query: ContractPackagesQuery }, result: { data: { packages } } },
    createMock(captured),
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <ContractFormDialog open onOpenChange={() => undefined} />
      </MemoryRouter>
    </MockedProvider>,
  );
}

const fillText = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

describe('ContractFormDialog — novo contrato sem grupo', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'MANAGER', permissions: [] });
  });

  it('sem cliente ou sem data o botão fica desabilitado e mostra o que falta', async () => {
    renderNew({ vars: null });
    await screen.findByTestId('new-contract-fields');
    expect(screen.getByTestId('contract-submit')).toBeDisabled();
    expect(screen.getByTestId('contract-missing')).toHaveTextContent('Noiva: informe o nome.');
    fillText('nc-bride-name', 'Ana Souza');
    expect(screen.getByTestId('contract-missing')).toHaveTextContent('Informe a data do evento.');
    fillText('nc-date', '2030-06-15');
    expect(screen.queryByTestId('contract-missing')).not.toBeInTheDocument();
  });

  it('noiva: envia newGroup sem groupId e itens sem groupMemberId', async () => {
    const captured: Captured = { vars: null };
    renderNew(captured);
    await screen.findByTestId('new-contract-fields');
    fillText('nc-bride-name', 'Ana Souza');
    fillText('nc-bride-phone', '11988887777');
    fillText('nc-date', '2030-06-15');
    fireEvent.change(screen.getByLabelText('Pessoa'), { target: { value: 'nova-noiva' } });
    fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    const items = screen.getByTestId('contract-items');
    expect(within(items).getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByTestId('contract-form-total')).toHaveTextContent('R$ 800,00');
    expect(screen.getByTestId('contract-summary')).toHaveTextContent('Restante até 08/06/2030');
    typeMoney('Valor do sinal (R$)', '10000');
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.groupId).toBeUndefined();
    expect(input.newGroup).toMatchObject({
      eventKind: 'noiva',
      eventDate: '2030-06-15',
      bride: { newClient: { fullName: 'Ana Souza', phone: expect.any(String) } },
    });
    const sent = input.items as Array<Vars>;
    expect(sent).toHaveLength(1);
    expect(sent[0].serviceId).toBe('s1');
    expect(sent[0].groupMemberId).toBeUndefined();
  });

  it('debutante: pede a responsável e envia newResponsible', async () => {
    const captured: Captured = { vars: null };
    renderNew(captured);
    await screen.findByTestId('new-contract-fields');
    expect(screen.queryByTestId('nc-responsible-name')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('nc-kind-debutante'));
    fillText('nc-bride-name', 'Lia Costa');
    fillText('nc-date', '2030-07-20');
    expect(screen.getByTestId('contract-missing')).toHaveTextContent('Responsável: informe o nome.');
    fillText('nc-responsible-name', 'Marta Costa');
    fireEvent.change(screen.getByLabelText('Pessoa'), { target: { value: 'nova-noiva' } });
    fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    typeMoney('Valor do sinal (R$)', '10000');
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.newGroup).toMatchObject({
      eventKind: 'debutante',
      bride: { newClient: { fullName: 'Lia Costa' } },
      newResponsible: { fullName: 'Marta Costa' },
    });
  });

  it('com pacote os itens da noiva vêm do pacote e não são enviados', async () => {
    const captured: Captured = { vars: null };
    renderNew(captured, [
      {
        __typename: 'Package',
        id: 'p1',
        name: 'Pacote Ouro',
        price: '2500.00',
        depositKind: null,
        depositValue: null,
      },
    ]);
    await screen.findByTestId('new-contract-fields');
    fillText('nc-bride-name', 'Ana Souza');
    fillText('nc-date', '2030-06-15');
    fireEvent.change(screen.getByLabelText('Pacote (opcional)'), { target: { value: 'p1' } });
    expect(screen.getByTestId('contract-form-total')).toHaveTextContent('R$ 2.500,00');
    typeMoney('Valor do sinal (R$)', '10000');
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.packageId).toBe('p1');
    expect(input.items).toBeUndefined();
    expect(input.newGroup).toMatchObject({ eventDate: '2030-06-15' });
  });
});

const PKGS = [
  { __typename: 'Package', id: 'p-fixo', name: 'Pacote Fixo', price: '2500.00', depositKind: 'fixed', depositValue: '500.00' },
  { __typename: 'Package', id: 'p-pct', name: 'Pacote Pct', price: '2000.00', depositKind: 'percent', depositValue: '30' },
  { __typename: 'Package', id: 'p-sem', name: 'Pacote Sem', price: '1000.00', depositKind: null, depositValue: null },
];

async function openNew(captured: Captured) {
  renderNew(captured, PKGS);
  await screen.findByTestId('new-contract-fields');
  await screen.findByRole('option', { name: /Pacote Fixo/ });
  fillText('nc-bride-name', 'Ana Souza');
  fillText('nc-date', '2030-06-15');
}
const pick = (id: string) =>
  fireEvent.change(screen.getByLabelText('Pacote (opcional)'), { target: { value: id } });
const sinal = () => screen.getByLabelText('Valor do sinal (R$)');

describe('ContractFormDialog — sinal pré-preenchido pelo pacote', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'MANAGER', permissions: [] });
  });

  it('pacote fixo preenche o campo, o resumo e a parcela única', async () => {
    const captured: Captured = { vars: null };
    await openNew(captured);
    pick('p-fixo');
    expect(sinal()).toHaveValue('500,00');
    expect(within(screen.getByTestId('contract-summary')).getAllByText('R$ 500,00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.depositAmount).toBe('500.00');
    expect(input.installments).toEqual([{ dueDate: todayIso(), amount: '500.00' }]);
  });

  it('pacote em % recalcula quando o desconto muda', async () => {
    await openNew({ vars: null });
    pick('p-pct');
    expect(sinal()).toHaveValue('600,00');
    typeMoney('Desconto (R$)', '50000');
    expect(sinal()).toHaveValue('450,00');
  });

  it('trocar de pacote troca o valor; sem entrada fica vazio', async () => {
    await openNew({ vars: null });
    pick('p-fixo');
    expect(sinal()).toHaveValue('500,00');
    pick('p-pct');
    expect(sinal()).toHaveValue('600,00');
    pick('p-sem');
    expect(sinal()).toHaveValue('');
    expect(sinal()).toHaveAttribute('placeholder', '0,00');
  });

  it('valor digitado não é sobrescrito e o botão restaura o do pacote', async () => {
    const captured: Captured = { vars: null };
    await openNew(captured);
    pick('p-pct');
    typeMoney('Valor do sinal (R$)', '70000');
    expect(sinal()).toHaveValue('700,00');
    typeMoney('Desconto (R$)', '50000');
    expect(sinal()).toHaveValue('700,00');
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    expect(((captured.vars as Vars).input as Vars).depositAmount).toBe('700.00');
    fireEvent.click(screen.getByTestId('contract-deposit-reset'));
    expect(sinal()).toHaveValue('450,00');
    expect(screen.queryByTestId('contract-deposit-reset')).not.toBeInTheDocument();
  });

  it('limpar o campo e sair volta ao valor do pacote', async () => {
    await openNew({ vars: null });
    pick('p-fixo');
    typeMoney('Valor do sinal (R$)', '');
    fireEvent.blur(sinal());
    expect(sinal()).toHaveValue('500,00');
  });

  it('rascunho mantém o sinal salvo ao abrir', async () => {
    const captured: Captured = { vars: null };
    renderEdit(makePackageContract(), captured, [
      { __typename: 'Package', id: 'p1', name: 'Pacote Ouro', price: '2500.00', depositKind: 'fixed', depositValue: '999.00' },
    ]);
    await screen.findByTestId('contract-items');
    expect(sinal()).toHaveValue('400,00');
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    expect(((captured.vars as Vars).input as Vars).depositAmount).toBe('400.00');
  });

  it('à vista continua readOnly com o total e Sinal volta ao pacote', async () => {
    await openNew({ vars: null });
    pick('p-fixo');
    fireEvent.click(screen.getByLabelText('À vista'));
    expect(sinal()).toHaveValue('2.500,00');
    expect(sinal()).toHaveAttribute('readonly');
    fireEvent.click(screen.getByLabelText('Sinal'));
    expect(sinal()).toHaveValue('500,00');
  });
});

// Garante que a fixture base continua válida para os demais testes.
describe('fixtures', () => {
  it('makeContract tem parcelas e itens com isPackageItem', () => {
    const c = makeContract();
    expect(c.installments.length).toBeGreaterThan(0);
    expect(c.items[0].isPackageItem).toBe(false);
  });
});
