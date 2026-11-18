import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import type { MockedResponse } from '@apollo/client/testing';
import { FormSettingsTab } from '../components/FormSettingsTab';
import {
  CommercialAssigneesForIntakeQuery,
  CommercialFormSettingsQuery,
  RegenerateCommercialFormTokenMutation,
  UpdateCommercialFormSettingsMutation,
} from '../api/intake.api';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const SETTINGS = {
  isActive: false,
  token: 'tok1',
  publicPath: '/contato/org1/tok1',
  defaultAssignee: null,
  successMessage: 'Obrigada!',
  consentText: 'Autorizo.',
  consentTextVersion: 'v1',
  __typename: 'CommercialFormSettings',
};

const calls = { update: 0, regen: 0 };

function mocks(): MockedResponse[] {
  return [
    {
      request: { query: CommercialFormSettingsQuery },
      result: { data: { commercialFormSettings: SETTINGS } },
    },
    {
      request: { query: CommercialAssigneesForIntakeQuery },
      result: {
        data: {
          commercialAssignees: [
            { id: 'm1', displayName: 'Bia', roleName: 'MANAGER', __typename: 'CommercialMember' },
          ],
        },
      },
    },
    {
      request: {
        query: UpdateCommercialFormSettingsMutation,
        variables: { input: { isActive: true } },
      },
      result: () => {
        calls.update += 1;
        return {
          data: {
            updateCommercialFormSettings: {
              settings: { ...SETTINGS, isActive: true },
              errors: [],
              __typename: 'CommercialFormSettingsPayload',
            },
          },
        };
      },
    },
    {
      request: { query: RegenerateCommercialFormTokenMutation },
      result: () => {
        calls.regen += 1;
        return {
          data: {
            regenerateCommercialFormToken: {
              settings: { ...SETTINGS, token: 'tok2', publicPath: '/contato/org1/tok2' },
              errors: [],
              __typename: 'CommercialFormSettingsPayload',
            },
          },
        };
      },
    },
  ];
}

describe('FormSettingsTab', () => {
  it('liga o formulário, mostra link e iframe, e regera o token com confirmação', async () => {
    render(
      <MockedProvider mocks={mocks()}>
        <FormSettingsTab />
      </MockedProvider>,
    );
    const toggle = await screen.findByRole('switch', { name: 'Formulário ativo' });
    expect(screen.getByDisplayValue(`${window.location.origin}/contato/org1/tok1`)).toBeInTheDocument();
    expect((screen.getByLabelText('Código para o site do salão') as HTMLTextAreaElement).value)
      .toContain('<iframe src="');

    fireEvent.click(toggle);
    await waitFor(() => expect(calls.update).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'Gerar novo link' }));
    expect(await screen.findByText('O link antigo deixa de funcionar.')).toBeInTheDocument();
    expect(calls.regen).toBe(0);
    const buttons = screen.getAllByRole('button', { name: 'Gerar novo link' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(calls.regen).toBe(1));
  });
});
