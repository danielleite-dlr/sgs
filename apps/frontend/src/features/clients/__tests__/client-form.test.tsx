import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import type { MockedResponse } from '@apollo/client/testing';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/infrastructure/i18n';
import { ClientForm } from '../components/ClientForm';
import {
  ClientsByFieldQuery,
  CreateClientMutation,
  ClientsListQuery,
} from '../api/clients.api';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderForm(mocks: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ClientForm />
        </MemoryRouter>
      </I18nextProvider>
    </MockedProvider>,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('ClientForm', () => {
  it('shows validation errors when submitting empty form (fullName + contact required)', async () => {
    renderForm();
    const submitBtn = screen.getByRole('button', { name: /salvar/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    await waitFor(() => {
      expect(screen.getByText(/Digite um nome válido\./i)).toBeInTheDocument();
    });
  });

  it('fires ClientsByFieldQuery on valid CPF blur and renders CpfDuplicateAlert', async () => {
    const validCpf = '529.982.247-25';
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ClientsByFieldQuery,
          variables: { cpf: '52998224725', phone: undefined, email: undefined, excludeId: undefined },
        },
        result: {
          data: {
            clientsByField: [{ id: 'dup-1', fullName: 'Ana Duplicate', phone: '(11) 99999-0000', email: null, cpf: '52998224725' }],
          },
        },
      },
    ];
    renderForm(mocks);

    const cpfInput = screen.getByRole('textbox', { name: /cpf/i });
    await act(async () => {
      fireEvent.change(cpfInput, { target: { value: validCpf } });
    });
    await act(async () => {
      fireEvent.blur(cpfInput);
    });

    await waitFor(() => {
      expect(screen.getByText(/CPF já cadastrado/i)).toBeInTheDocument();
    });
  });

  it('does NOT fire ClientsByFieldQuery on invalid CPF blur (111.111.111-11)', async () => {
    const queryMock = vi.fn();
    // Build a spy mock that should NOT be called
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ClientsByFieldQuery,
          variables: { cpf: '11111111111', phone: undefined, email: undefined, excludeId: undefined },
        },
        result: () => {
          queryMock(); // should NOT be called
          return { data: { clientsByField: [] } };
        },
      },
    ];
    renderForm(mocks);

    const cpfInput = screen.getByRole('textbox', { name: /cpf/i });
    await act(async () => {
      fireEvent.change(cpfInput, { target: { value: '111.111.111-11' } });
    });
    await act(async () => {
      fireEvent.blur(cpfInput);
    });

    // Wait briefly to ensure no query fires
    await new Promise((r) => setTimeout(r, 100));
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('calls CreateClientMutation with CPF digits-only on submit', async () => {
    let mutationCalled = false;
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ClientsListQuery,
          variables: { search: null, limit: 20, offset: 0 },
        },
        result: { data: { clients: { rows: [], totalCount: 0 } } },
      },
      {
        request: {
          query: CreateClientMutation,
          variables: {
            input: {
              fullName: 'Teste Usuário',
              phone: '(11) 91111-1111',
              email: null,
              cpf: '52998224725',
              birthDate: null,
              address: null,
              notes: null,
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        result: () => {
          mutationCalled = true;
          return {
            data: {
              createClient: {
                client: { id: 'new-id', fullName: 'Teste Usuário', phone: '(11) 91111-1111', email: null, cpf: '52998224725', birthDate: null, address: null, notes: null, createdAt: '', updatedAt: '' },
                errors: [],
              },
            },
          };
        },
      },
    ];
    renderForm(mocks);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Maria da Silva/i), { target: { value: 'Teste Usuário' } });
      fireEvent.change(screen.getByRole('textbox', { name: /celular 1/i }), { target: { value: '(11) 91111-1111' } });
      fireEvent.change(screen.getByRole('textbox', { name: /cpf/i }), { target: { value: '529.982.247-25' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    });

    await waitFor(() => {
      expect(mutationCalled).toBe(true);
    }, { timeout: 2000 });
  });

  it('shows contact required error when submitting without phone AND email', async () => {
    renderForm();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Maria da Silva/i), { target: { value: 'Nome Válido Aqui' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Informe pelo menos um telefone ou e-mail\./i)).toBeInTheDocument();
    });
  });

  it('maps CONTACT_REQUIRED server error to phone field', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CreateClientMutation,
          variables: {
            input: {
              fullName: 'Nome Teste',
              phone: null,
              email: 'test@example.com',
              cpf: null,
              birthDate: null,
              address: null,
              notes: null,
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        result: {
          data: {
            createClient: {
              client: null,
              errors: [{ code: 'CONTACT_REQUIRED', message: 'Informe pelo menos um telefone ou e-mail.', field: null }],
            },
          },
        },
      },
    ];
    renderForm(mocks);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Maria da Silva/i), { target: { value: 'Nome Teste' } });
      fireEvent.change(screen.getByRole('textbox', { name: /e-mail/i }), { target: { value: 'test@example.com' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Informe pelo menos um telefone ou e-mail\./i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('aplica máscaras de RG, CEP e Celular 2 e envia os valores no create', async () => {
    let variablesOk = false;
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ClientsListQuery,
          variables: { search: null, limit: 20, offset: 0 },
        },
        result: { data: { clients: { rows: [], totalCount: 0 } } },
      },
      {
        request: {
          query: CreateClientMutation,
          variables: {
            input: {
              fullName: 'Maria Teste',
              phone: '(11) 91111-1111',
              email: null,
              cpf: null,
              birthDate: null,
              address: null,
              rg: '48.830.035-6',
              postalCode: '06083-290',
              phone2: '(11) 92222-2222',
              notes: null,
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        result: () => {
          variablesOk = true;
          return {
            data: {
              createClient: { client: { id: 'x', fullName: 'Maria Teste' }, errors: [] },
            },
          };
        },
      },
    ];
    renderForm(mocks);

    const rg = screen.getByRole('textbox', { name: /^rg/i });
    const cep = screen.getByRole('textbox', { name: /^cep/i });
    const phone2 = screen.getByRole('textbox', { name: /celular 2/i });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Maria da Silva/i), { target: { value: 'Maria Teste' } });
      fireEvent.change(screen.getByRole('textbox', { name: /celular 1/i }), { target: { value: '11911111111' } });
      fireEvent.change(rg, { target: { value: '488300356' } });
      fireEvent.change(cep, { target: { value: '06083290' } });
      fireEvent.change(phone2, { target: { value: '11922222222' } });
    });
    expect(rg).toHaveValue('48.830.035-6');
    expect(cep).toHaveValue('06083-290');
    expect(phone2).toHaveValue('(11) 92222-2222');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    });
    await waitFor(() => expect(variablesOk).toBe(true), { timeout: 2000 });
  });

  it('mostra CEP inválido quando incompleto', async () => {
    renderForm();
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Maria da Silva/i), { target: { value: 'Maria Teste' } });
      fireEvent.change(screen.getByRole('textbox', { name: /celular 1/i }), { target: { value: '11911111111' } });
      fireEvent.change(screen.getByRole('textbox', { name: /^cep/i }), { target: { value: '0608' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    });
    await waitFor(() => {
      expect(screen.getByText(/CEP inválido/i)).toBeInTheDocument();
    });
  });

  it('edição carrega RG, CEP e celulares existentes', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <ClientForm
              initial={{
                id: 'c1',
                fullName: 'Ana',
                phone: '(11) 91111-1111',
                email: null,
                cpf: null,
                birthDate: null,
                address: null,
                rg: '488300356',
                postalCode: '06083290',
                phone2: '(11) 92222-2222',
                phone3: null,
                notes: null,
                createdAt: '',
                updatedAt: '',
              }}
            />
          </MemoryRouter>
        </I18nextProvider>
      </MockedProvider>,
    );
    expect(screen.getByRole('textbox', { name: /^rg/i })).toHaveValue('48.830.035-6');
    expect(screen.getByRole('textbox', { name: /^cep/i })).toHaveValue('06083-290');
    expect(screen.getByRole('textbox', { name: /celular 2/i })).toHaveValue('(11) 92222-2222');
  });
});
