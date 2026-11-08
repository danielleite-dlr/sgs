import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n/index';
import { PacoteForm } from '../components/PacoteForm';
import { ServicesQuery } from '../api/servicos.api';
import { UpdatePackageMutation, PackagesQuery } from '../api/pacotes.api';

const MAKE = '11111111-1111-4111-8111-111111111111';
const MASSAGEM = '22222222-2222-4222-8222-222222222222';

function setup(spy: ReturnType<typeof vi.fn>, makeTrial?: boolean) {
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
          name: 'Essence',
          price: '800.00',
          services: [
            { serviceId: MAKE, quantity: 1, includesTrial: makeTrial },
            { serviceId: MASSAGEM, quantity: 1 },
          ],
        }}
      />
    </MockedProvider>,
  );
}

const checkbox = (serviceId: string) =>
  within(screen.getByTestId(`package-service-trial-${serviceId}`)).getByRole('checkbox');

function sentServices(spy: ReturnType<typeof vi.fn>) {
  return (spy.mock.calls[0][0] as { input: { services: unknown[] } }).input.services;
}

describe('PacoteForm — "Inclui teste" por serviço (261108-n2o)', () => {
  it('padrão desligado; marcar e salvar envia includesTrial só no serviço marcado', async () => {
    const spy = vi.fn();
    setup(spy);
    expect(checkbox(MAKE)).not.toBeChecked();
    expect(checkbox(MASSAGEM)).not.toBeChecked();
    expect(screen.getAllByText('metade do valor no teste, cobrado no evento')).toHaveLength(2);
    fireEvent.click(checkbox(MAKE));
    expect(checkbox(MAKE)).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(sentServices(spy)).toEqual([
      { serviceId: MAKE, quantity: 1, includesTrial: true },
      { serviceId: MASSAGEM, quantity: 1, includesTrial: false },
    ]);
  });

  it('editar pacote carrega a marca existente e desmarcar envia false', async () => {
    const spy = vi.fn();
    setup(spy, true);
    expect(checkbox(MAKE)).toBeChecked();
    fireEvent.click(checkbox(MAKE));
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(sentServices(spy)).toEqual([
      { serviceId: MAKE, quantity: 1, includesTrial: false },
      { serviceId: MASSAGEM, quantity: 1, includesTrial: false },
    ]);
  });
});
