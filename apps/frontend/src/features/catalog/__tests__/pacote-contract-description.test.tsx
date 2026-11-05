import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n/index';
import { PacoteForm } from '../components/PacoteForm';
import { ServicesQuery } from '../api/servicos.api';
import { UpdatePackageMutation, PackagesQuery } from '../api/pacotes.api';

const SVC = '11111111-1111-4111-8111-111111111111';

function setup(spy: ReturnType<typeof vi.fn>, contractDescription?: string | null) {
  const mocks = [
    { request: { query: ServicesQuery }, result: { data: { services: [] } }, maxUsageCount: 10 },
    { request: { query: PackagesQuery }, result: { data: { packages: [] } }, maxUsageCount: 10 },
    {
      request: { query: UpdatePackageMutation },
      variableMatcher: (vars: Record<string, unknown>) => {
        spy(vars);
        return true;
      },
      result: { data: { updatePackage: { package: null, errors: [] } } },
    },
  ];
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <PacoteForm
        onClose={() => {}}
        initial={{
          id: 'p1',
          name: 'Noiva completo',
          price: '500.00',
          services: [{ serviceId: SVC, quantity: 1 }],
          contractDescription,
        }}
      />
    </MockedProvider>,
  );
}

function sentInput(spy: ReturnType<typeof vi.fn>) {
  return (spy.mock.calls[0][0] as { input: Record<string, unknown> }).input;
}

describe('PacoteForm — descrição para contrato', () => {
  it('preencher e salvar envia contractDescription', async () => {
    const spy = vi.fn();
    setup(spy);
    fireEvent.change(screen.getByLabelText('Descrição para contrato'), {
      target: { value: 'Maquiagem e penteado da noiva' },
    });
    expect(screen.getByText('29/2000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(sentInput(spy).contractDescription).toBe('Maquiagem e penteado da noiva');
  });

  it('editar pacote carrega o valor existente', () => {
    setup(vi.fn(), 'Texto salvo');
    expect(screen.getByLabelText('Descrição para contrato')).toHaveValue('Texto salvo');
  });

  it('limpar o campo envia null', async () => {
    const spy = vi.fn();
    setup(spy, 'Texto salvo');
    fireEvent.change(screen.getByLabelText('Descrição para contrato'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(sentInput(spy).contractDescription).toBeNull();
  });

  it('2001 caracteres bloqueia o envio', async () => {
    const spy = vi.fn();
    setup(spy);
    fireEvent.change(screen.getByLabelText('Descrição para contrato'), {
      target: { value: 'a'.repeat(2001) },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() =>
      expect(screen.getByText('Use no máximo 2000 caracteres.')).toBeInTheDocument(),
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
