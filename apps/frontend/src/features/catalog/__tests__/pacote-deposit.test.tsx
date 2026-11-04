import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n/index';
import { PacoteForm } from '../components/PacoteForm';
import { ServicesQuery } from '../api/servicos.api';
import { UpdatePackageMutation, PackagesQuery } from '../api/pacotes.api';

const SVC = '11111111-1111-4111-8111-111111111111';

function setup(spy: ReturnType<typeof vi.fn>) {
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
        }}
      />
    </MockedProvider>,
  );
}

describe('PacoteForm — entrada do contrato', () => {
  it('Percentual 30 envia depositKind percent e depositValue 30', async () => {
    const spy = vi.fn();
    setup(spy);
    fireEvent.change(screen.getByLabelText('Entrada do contrato'), { target: { value: 'percent' } });
    fireEvent.change(screen.getByLabelText('Percentual da entrada'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const input = (spy.mock.calls[0][0] as { input: Record<string, unknown> }).input;
    expect(input.depositKind).toBe('percent');
    expect(input.depositValue).toBe('30');
  });

  it('120% mostra erro e não envia', async () => {
    const spy = vi.fn();
    setup(spy);
    fireEvent.change(screen.getByLabelText('Entrada do contrato'), { target: { value: 'percent' } });
    fireEvent.change(screen.getByLabelText('Percentual da entrada'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() =>
      expect(screen.getByText('O percentual deve ficar entre 0 e 100.')).toBeInTheDocument(),
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('sem entrada envia null', async () => {
    const spy = vi.fn();
    setup(spy);
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const input = (spy.mock.calls[0][0] as { input: Record<string, unknown> }).input;
    expect(input.depositKind).toBeNull();
    expect(input.depositValue).toBeNull();
  });
});
