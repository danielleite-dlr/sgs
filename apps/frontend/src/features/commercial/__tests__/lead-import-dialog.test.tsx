import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import type { MockedResponse } from '@apollo/client/testing';
import { LeadImportDialog } from '../components/LeadImportDialog';
import {
  ImportCommercialLeadsMutation,
  PreviewCommercialLeadImportMutation,
} from '../api/intake.api';

const ROW_OK = {
  line: 2,
  fullName: 'Ana Souza',
  phone: '11999990000',
  email: null,
  kind: 'noiva',
  eventDate: null,
  source: 'import',
  notes: null,
  duplicateOf: null,
  assigneeRef: 'bia@x.com',
  assignee: { id: 'm1', displayName: 'Bia Gerente', roleName: 'MANAGER', __typename: 'CommercialMember' },
  assigneeWarning: null,
  __typename: 'CommercialImportRow',
};
const ROW_DUP = {
  ...ROW_OK,
  line: 3,
  fullName: 'Carla',
  duplicateOf: { type: 'client', id: 'c1', name: 'Carla Cliente', __typename: 'CommercialImportDuplicate' },
  assignee: null,
  assigneeRef: 'Fulana',
  assigneeWarning: 'responsável não encontrado: Fulana',
};

const PREVIEW = {
  totalRows: 3,
  valid: [ROW_OK, ROW_DUP],
  invalid: [{ line: 4, reason: 'Nome obrigatório', __typename: 'CommercialImportInvalid' }],
  errors: [],
  __typename: 'CommercialImportPreview',
};

function mocks(): MockedResponse[] {
  return [
    {
      request: {
        query: PreviewCommercialLeadImportMutation,
        variables: { base64: 'QUJD', filename: 'leads.csv' },
      },
      result: { data: { previewCommercialLeadImport: PREVIEW } },
    },
    {
      request: {
        query: ImportCommercialLeadsMutation,
        variables: { base64: 'QUJD', filename: 'leads.csv' },
      },
      result: {
        data: {
          importCommercialLeads: {
            createdLeads: 3,
            createdDeals: 2,
            linkedClients: 0,
            assignedDeals: 1,
            unassignedDeals: 1,
            skipped: 1,
            errors: [],
            __typename: 'CommercialImportResult',
          },
        },
      },
    },
  ];
}

function setup(onImported = vi.fn()) {
  render(
    <MockedProvider mocks={mocks()}>
      <LeadImportDialog open onOpenChange={() => {}} onImported={onImported} />
    </MockedProvider>,
  );
  return onImported;
}

function pick(file: File) {
  fireEvent.change(screen.getByLabelText(/Arquivo .xlsx ou .csv/), { target: { files: [file] } });
}

describe('LeadImportDialog', () => {
  it('rejeita .pdf sem chamar a API', async () => {
    setup();
    pick(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText('Use um arquivo .xlsx ou .csv')).toBeInTheDocument();
  });

  it('rejeita arquivo maior que 2,5 MB', async () => {
    setup();
    const big = new File(['x'], 'a.csv', { type: 'text/csv' });
    Object.defineProperty(big, 'size', { value: 2_500_001 });
    pick(big);
    expect(await screen.findByText('Arquivo maior que 2,5 MB')).toBeInTheDocument();
  });

  it('mostra a prévia com responsável e avisos, sem seletor, e importa', async () => {
    const onImported = setup();
    pick(new File(['ABC'], 'leads.csv', { type: 'text/csv' }));
    expect(await screen.findByText(/2 válidas/)).toBeInTheDocument();
    expect(screen.getByText(/1 com problema/)).toBeInTheDocument();
    expect(screen.getByText('Linha 4: Nome obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Bia Gerente')).toBeInTheDocument();
    expect(screen.getByText('Já é cliente: Carla Cliente')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('responsável não encontrado: Fulana');
    expect(screen.getByText(/1 linha sem responsável vai para a fila de gerentes/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(
      await screen.findByText('3 leads e 2 negócios criados (1 com responsável, 1 sem), 1 ignorado'),
    ).toBeInTheDocument();
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(3));
  });

  it('lista as colunas aceitas', () => {
    setup();
    expect(screen.getByText(/Responsável \(e-mail ou nome/)).toBeInTheDocument();
  });
});
