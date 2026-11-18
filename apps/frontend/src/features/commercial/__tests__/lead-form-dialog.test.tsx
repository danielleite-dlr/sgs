import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import {
  CommercialDuplicateCheckQuery,
  CreateCommercialLeadMutation,
} from '../api/leads.api';
import { LeadFormDialog } from '../components/LeadFormDialog';

const FULANA = { __typename: 'CommercialClientRef', id: 'c-1', fullName: 'Fulana', phone: null, email: null };
const BELTRANA = { __typename: 'CommercialLeadRef', id: 'l-9', fullName: 'Beltrana', phone: null, email: null };

function leadResult() {
  return {
    __typename: 'CommercialLead',
    id: 'l-new',
    fullName: 'Nova',
    phone: '(11) 99999-0000',
    email: null,
    source: 'manual',
    notes: null,
    client: null,
    createdBy: null,
    consentAt: null,
    createdAt: '2026-11-18T10:00:00.000Z',
    openDeals: 0,
    lastInteractionAt: null,
  };
}

function setup(opts: { clients?: unknown[]; leads?: unknown[]; errors?: unknown[] } = {}) {
  const sent: { input?: Record<string, unknown> } = {};
  const check: MockedResponse = {
    request: { query: CommercialDuplicateCheckQuery },
    variableMatcher: () => true,
    maxUsageCount: 10,
    result: {
      data: {
        commercialDuplicateCheck: {
          __typename: 'CommercialDuplicateCheck',
          clients: opts.clients ?? [],
          leads: opts.leads ?? [],
        },
      },
    },
  };
  const create: MockedResponse = {
    request: { query: CreateCommercialLeadMutation },
    variableMatcher: (v) => {
      sent.input = (v as { input: Record<string, unknown> }).input;
      return true;
    },
    result: {
      data: {
        createCommercialLead: {
          __typename: 'CommercialLeadPayload',
          lead: opts.errors ? null : leadResult(),
          errors: opts.errors ?? [],
        },
      },
    },
  };
  const onSaved = vi.fn();
  render(
    <MemoryRouter>
      <MockedProvider mocks={[check, create]}>
        <LeadFormDialog open onOpenChange={() => {}} onSaved={onSaved} />
      </MockedProvider>
    </MemoryRouter>,
  );
  return { sent, onSaved };
}

function typeName(name = 'Nova') {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: name } });
}
function typePhone() {
  fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '(11) 99999-0000' } });
}

describe('LeadFormDialog', () => {
  it('avisa cliente existente e liga a cliente ao criar', async () => {
    const { sent, onSaved } = setup({ clients: [FULANA] });
    typeName();
    typePhone();
    expect(await screen.findByText('Já é cliente: Fulana', {}, { timeout: 3000 })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ligar a esta cliente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent.input?.clientId).toBe('c-1');
  });

  it('mostra lead repetido com link para o lead existente', async () => {
    setup({ leads: [BELTRANA] });
    typePhone();
    expect(await screen.findByText('Já existe um lead: Beltrana', {}, { timeout: 3000 })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Abrir lead existente' });
    expect(link.getAttribute('href')).toBe('/comercial/leads/l-9');
  });

  it('exige telefone ou e-mail sem chamar a API', async () => {
    const { sent, onSaved } = setup();
    typeName();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Informe telefone ou e-mail')).toBeTruthy();
    expect(sent.input).toBeUndefined();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('mostra o erro devolvido pela API', async () => {
    setup({ errors: [{ __typename: 'UserError', code: 'x', message: 'Telefone inválido', field: null }] });
    typeName();
    typePhone();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Telefone inválido')).toBeTruthy();
  });
});
