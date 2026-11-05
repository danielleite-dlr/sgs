import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  ContractGroupQuery,
  ContractPackagesQuery,
  ContractPreviewPdfQuery,
  ContractServicesQuery,
  ContractSettingsQuery,
} from '../api/contracts.api';
import { ContractFormDialog } from '../components/ContractFormDialog';
import { makeContract, makeSettings } from './contract-fixtures';

type Vars = Record<string, unknown>;

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
            services: [],
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
  {
    request: { query: ContractSettingsQuery },
    result: { data: { contractSettings: makeSettings() } },
  },
];

const PDF_B64 = btoa('%PDF-1.7 prévia de teste');

interface PreviewServer {
  calls: Vars[];
  errors: unknown[];
}

function previewMock(server: PreviewServer, delay = 0): MockedResponse {
  return {
    request: { query: ContractPreviewPdfQuery },
    variableMatcher: () => true,
    maxUsageCount: Number.POSITIVE_INFINITY,
    delay,
    result: (vars: Vars) => {
      server.calls.push(vars.input as Vars);
      const failed = server.errors.length > 0;
      return {
        data: {
          contractPreviewPdf: {
            __typename: 'ContractPreviewPdf',
            filename: failed ? null : 'PREVIA - NOIVA_ANA.pdf',
            base64: failed ? null : PDF_B64,
            errors: server.errors,
          },
        },
      };
    },
  };
}

function renderForm(
  server: PreviewServer,
  props: { groupId?: string; contract?: ReturnType<typeof makeContract> } = {},
  delay = 0,
) {
  return render(
    <MockedProvider mocks={[...BASE_MOCKS, previewMock(server, delay)]}>
      <MemoryRouter>
        <ContractFormDialog open onOpenChange={() => undefined} {...props} />
      </MemoryRouter>
    </MockedProvider>,
  );
}

const fillText = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

async function fillNewContract() {
  await screen.findByTestId('new-contract-fields');
  fillText('nc-bride-name', 'Ana Souza');
  fillText('nc-date', '2030-06-15');
  fireEvent.change(screen.getByLabelText('Pessoa'), { target: { value: 'nova-noiva' } });
  fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: 's1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

let blobSeq = 0;
function setViewport(lg: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: lg,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

describe('ContractFormDialog — prévia do contrato em PDF', () => {
  let server: PreviewServer;

  beforeEach(() => {
    useAuthStore.setState({ roleName: 'MANAGER', permissions: [] });
    server = { calls: [], errors: [] };
    blobSeq = 0;
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => `blob:mock/${++blobSeq}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error -- jsdom não tem matchMedia; remove o stub do teste
    delete window.matchMedia;
  });

  it('telas largas: gera uma vez ~1 s após a última mudança e mostra o PDF no iframe', async () => {
    setViewport(true);
    renderForm(server);
    await fillNewContract();
    await advance(500);
    expect(server.calls).toHaveLength(0);
    await advance(600);
    const frame = await screen.findByTestId('contract-preview-frame');
    expect(server.calls).toHaveLength(1);
    expect(frame).toHaveAttribute('src', 'blob:mock/1');
    expect(frame).toHaveAttribute('title', 'Prévia do contrato');
    const input = server.calls[0];
    expect(input.newGroup).toMatchObject({ eventDate: '2030-06-15' });
    expect(input.groupId).toBeUndefined();
    expect(input.contractId).toBeUndefined();
    expect((input.items as Vars[])[0]).toMatchObject({ serviceId: 's1', unitPrice: '800.00' });
  });

  it('Atualizar prévia gera na hora e mantém o PDF anterior enquanto carrega', async () => {
    setViewport(true);
    renderForm(server, {}, 400);
    await fillNewContract();
    await advance(1100);
    await advance(500);
    await waitFor(() =>
      expect(screen.getByTestId('contract-preview-frame')).toHaveAttribute('src', 'blob:mock/1'),
    );
    fireEvent.click(screen.getByRole('button', { name: /Atualizar prévia/ }));
    expect(screen.getByTestId('contract-preview-status')).toHaveTextContent('Gerando prévia…');
    expect(screen.getByTestId('contract-preview-frame')).toHaveAttribute('src', 'blob:mock/1');
    await advance(500);
    await waitFor(() =>
      expect(screen.getByTestId('contract-preview-frame')).toHaveAttribute('src', 'blob:mock/2'),
    );
    expect(server.calls).toHaveLength(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock/1');
    expect(screen.getByTestId('contract-preview-status')).toHaveTextContent('');
  });

  it('erro do backend aparece no painel e o último PDF continua', async () => {
    setViewport(true);
    renderForm(server);
    await fillNewContract();
    await advance(1100);
    await screen.findByTestId('contract-preview-frame');
    server.errors = [
      {
        __typename: 'UserError',
        code: 'INSTALLMENTS_SUM_MISMATCH',
        message: 'soma',
        field: 'installments',
      },
    ];
    fireEvent.click(screen.getByRole('button', { name: /Atualizar prévia/ }));
    expect(await screen.findByTestId('contract-preview-error')).toHaveTextContent(
      'A soma das parcelas deve ser igual ao valor do sinal.',
    );
    expect(screen.getByTestId('contract-preview-frame')).toHaveAttribute('src', 'blob:mock/1');
  });

  it('novo contrato sem cliente/data: nenhuma chamada e mensagem do que falta', async () => {
    setViewport(true);
    renderForm(server);
    await screen.findByTestId('new-contract-fields');
    fillText('nc-bride-name', 'Ana Souza');
    await advance(1500);
    expect(server.calls).toHaveLength(0);
    expect(screen.getByTestId('contract-preview-empty')).toHaveTextContent(
      'Informe a cliente e a data do evento para gerar a prévia.',
    );
    expect(screen.getByRole('button', { name: /Atualizar prévia/ })).toBeDisabled();
  });

  it('celular: sem iframe nem chamada automática; Ver prévia abre o PDF numa nova aba', async () => {
    setViewport(false);
    const win = { location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    renderForm(server);
    await fillNewContract();
    await advance(1500);
    expect(server.calls).toHaveLength(0);
    expect(screen.queryByTestId('contract-preview-frame')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('contract-preview-open'));
    expect(open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(win.location.href).toBe('blob:mock/1'));
    expect(server.calls).toHaveLength(1);
    expect(win.close).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('edição de rascunho manda contractId; caminho do grupo manda groupId', async () => {
    setViewport(true);
    const view = renderForm(server, { contract: makeContract({ status: 'draft' }) });
    await screen.findByTestId('contract-items');
    await advance(1100);
    await waitFor(() => expect(server.calls).toHaveLength(1));
    expect(server.calls[0].contractId).toBe('ct1');
    expect(server.calls[0].groupId).toBeUndefined();
    expect(server.calls[0].newGroup).toBeUndefined();
    view.unmount();

    server.calls = [];
    renderForm(server, { groupId: 'g1' });
    await screen.findByTestId('contract-items');
    fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await advance(1100);
    await waitFor(() => expect(server.calls).toHaveLength(1));
    expect(server.calls[0].groupId).toBe('g1');
    expect(server.calls[0].contractId).toBeUndefined();
    expect(server.calls[0].newGroup).toBeUndefined();
  });
});
