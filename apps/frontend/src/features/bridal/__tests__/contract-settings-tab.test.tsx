import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { ContractSettingsQuery, UpdateContractSettingsMutation } from '../api/contracts.api';
import { ContractSettingsTab } from '../components/ContractSettingsTab';
import { makeSettings } from './contract-fixtures';

const SETTINGS = makeSettings();

const queryMock = (settings = SETTINGS): MockedResponse => ({
  request: { query: ContractSettingsQuery },
  result: { data: { contractSettings: settings } },
});

function updateMock(input: Record<string, unknown>, payload: Record<string, unknown>) {
  return {
    request: { query: UpdateContractSettingsMutation, variables: { input } },
    result: {
      data: {
        updateContractSettings: {
          __typename: 'ContractSettingsPayload',
          ...payload,
        },
      },
    },
  } as MockedResponse;
}

/** Campos que o formulário sempre envia (valores inalterados). */
const BASE_INPUT = {
  balanceDueDaysBefore: 7,
  withdrawalNoticeDays: 7,
  alertDepositUnpaidDays: 3,
  alertNotAcceptedDays: 5,
  alertCompanionDepositDays: 30,
  scheduleDayStart: '08:00',
  scheduleDayEnd: '20:00',
};

function renderTab(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <ContractSettingsTab />
    </MockedProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('ContractSettingsTab', () => {
  it('editar o CNPJ e salvar envia studio.cnpj', async () => {
    const saved = makeSettings({
      studio: { ...SETTINGS.studio, cnpj: '11.222.333/0001-81' },
    });
    const mutation = updateMock(
      { ...BASE_INPUT, studio: { cnpj: '11.222.333/0001-81' } },
      { settings: saved, errors: [] },
    );
    const original = mutation.result;
    const spy = vi.fn(() => original);
    mutation.result = spy as unknown as MockedResponse['result'];
    renderTab([queryMock(), mutation, queryMock(saved)]);
    const input = await screen.findByLabelText('CNPJ');
    fireEvent.change(input, { target: { value: '11222333000181' } });
    expect(input).toHaveValue('11.222.333/0001-81');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
  });

  it('editar "Obs. dos testes" envia só texts.trialNote', async () => {
    const saved = makeSettings({
      texts: { ...SETTINGS.texts, trialNote: 'Testes na semana anterior.' },
      textsDefault: { ...SETTINGS.textsDefault, trialNote: false },
    });
    const mutation = updateMock(
      { ...BASE_INPUT, texts: { trialNote: 'Testes na semana anterior.' } },
      { settings: saved, errors: [] },
    );
    const original = mutation.result;
    const spy = vi.fn(() => original);
    mutation.result = spy as unknown as MockedResponse['result'];
    renderTab([queryMock(), mutation, queryMock(saved)]);
    const area = await screen.findByLabelText('Obs. dos testes');
    fireEvent.change(area, { target: { value: 'Testes na semana anterior.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
  });

  it('"Restaurar padrão" envia texts: { clauses: null } e volta ao texto padrão', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const edited = makeSettings({
      texts: { ...SETTINGS.texts, clauses: 'Cláusulas do salão.' },
      textsDefault: { ...SETTINGS.textsDefault, clauses: false },
    });
    const mutation = updateMock({ texts: { clauses: null } }, { settings: SETTINGS, errors: [] });
    const original = mutation.result;
    const spy = vi.fn(() => original);
    mutation.result = spy as unknown as MockedResponse['result'];
    renderTab([queryMock(edited), mutation, queryMock()]);
    const area = await screen.findByLabelText('Cláusulas II a VIII e disposições finais');
    expect(area).toHaveValue('Cláusulas do salão.');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Restaurar padrão: Cláusulas II a VIII e disposições finais',
      }),
    );
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByLabelText('Cláusulas II a VIII e disposições finais')).toHaveValue(
        SETTINGS.texts.clauses,
      ),
    );
  });

  it('erro UNKNOWN_TEMPLATE_VARIABLE aparece no campo das cláusulas', async () => {
    const mutation = updateMock(
      { ...BASE_INPUT, texts: { clauses: 'Valor {{foo}}' } },
      {
        settings: null,
        errors: [
          {
            __typename: 'UserError',
            code: 'UNKNOWN_TEMPLATE_VARIABLE',
            message: 'Variáveis desconhecidas no modelo: {{foo}}.',
            field: 'texts.clauses',
          },
        ],
      },
    );
    renderTab([queryMock(), mutation]);
    const area = await screen.findByLabelText('Cláusulas II a VIII e disposições finais');
    fireEvent.change(area, { target: { value: 'Valor {{foo}}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));
    const msg = await screen.findByText('Variáveis desconhecidas no modelo: {{foo}}.');
    expect(msg).toHaveAttribute('id', 'contract-text-clauses-error');
    expect(area).toHaveAttribute('aria-describedby', 'contract-text-clauses-error');
  });

  it('lista as variáveis disponíveis, inclusive {{prazo_desistencia_dias}}', async () => {
    renderTab([queryMock()]);
    expect(
      await screen.findByRole('button', { name: '{{prazo_desistencia_dias}}' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Prazo para desistência (dias)')).toHaveValue(7);
  });
});
