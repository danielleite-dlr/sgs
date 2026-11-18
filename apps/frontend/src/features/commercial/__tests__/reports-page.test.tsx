import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { CommercialAssigneesQuery, CommercialStagesQuery } from '../api/leads.api';
import { CommercialReportQuery, ExportCommercialReportQuery } from '../api/reports.api';
import { downloadBase64File } from '../lib/download-file';
import { ReportsPage } from '../pages/ReportsPage';
import { setRole } from './commercial-fixtures';

function report(truncated = false) {
  return {
    __typename: 'CommercialReport',
    totals: {
      __typename: 'CommercialReportTotals',
      deals: 3,
      open: 1,
      won: 1,
      lost: 1,
      openAmount: '500.00',
      wonAmount: '900.00',
      conversionRate: 0.5,
    },
    byStage: [
      {
        __typename: 'CommercialStageSummary',
        stageId: 's1',
        name: 'Proposta',
        color: '#3b82f6',
        kind: 'open',
        count: 1,
        amount: '500.00',
      },
    ],
    byAssignee: [
      {
        __typename: 'CommercialAssigneeSummary',
        memberId: 'm-1',
        name: 'Bia',
        deals: 3,
        won: 1,
        lost: 1,
        wonAmount: '900.00',
      },
    ],
    bySource: [
      { __typename: 'CommercialSourceSummary', source: 'instagram', label: 'Instagram', deals: 3, won: 1 },
    ],
    lostReasons: [
      { __typename: 'CommercialLostReasonSummary', code: 'price', label: 'Preço', count: 1 },
    ],
    rows: [],
    truncated,
  };
}

const lookups: MockedResponse[] = [
  {
    request: { query: CommercialStagesQuery },
    maxUsageCount: 10,
    result: { data: { commercialStages: [] } },
  },
  {
    request: { query: CommercialAssigneesQuery },
    maxUsageCount: 10,
    result: {
      data: {
        commercialAssignees: [
          { __typename: 'CommercialMember', id: 'm-1', displayName: 'Bia', roleName: 'ATTENDANT' },
        ],
      },
    },
  },
];

function reportMock(truncated = false): MockedResponse {
  return {
    request: { query: CommercialReportQuery },
    variableMatcher: () => true,
    maxUsageCount: 10,
    result: { data: { commercialReport: report(truncated) } },
  };
}

function exportMock(format: string, filename: string, onCall: (v: unknown) => void): MockedResponse {
  return {
    request: { query: ExportCommercialReportQuery },
    variableMatcher: (v) => {
      const ok = (v as { format: string }).format === format;
      if (ok) onCall(v);
      return ok;
    },
    result: {
      data: {
        exportCommercialReport: {
          __typename: 'CommercialExportFile',
          filename,
          mimeType: 'application/octet-stream',
          base64: 'AQID',
        },
      },
    },
  };
}

beforeEach(() => {
  setRole('MANAGER');
});
afterEach(() => {
  setRole(null);
  vi.restoreAllMocks();
});

describe('ReportsPage', () => {
  it('mostra totais e tabelas de origem e motivos de perda em português', async () => {
    render(
      <MockedProvider mocks={[...lookups, reportMock()]}>
        <ReportsPage />
      </MockedProvider>,
    );
    expect(await screen.findByText('Motivos de perda')).toBeTruthy();
    expect(screen.getByText('Preço')).toBeTruthy();
    expect(screen.getByText('Instagram', { selector: 'td' })).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.queryByText('Mostrando 5.000 primeiros')).toBeNull();
  });

  it('avisa quando o resultado foi truncado', async () => {
    render(
      <MockedProvider mocks={[...lookups, reportMock(true)]}>
        <ReportsPage />
      </MockedProvider>,
    );
    expect(await screen.findByText('Mostrando 5.000 primeiros')).toBeTruthy();
  });

  it('Exportar Excel e Exportar PDF baixam o arquivo do backend', async () => {
    const created: Blob[] = [];
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b) => {
      created.push(b);
      return 'blob:x';
    };
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    const sent: unknown[] = [];
    render(
      <MockedProvider
        mocks={[
          ...lookups,
          reportMock(),
          exportMock('xlsx', 'comercial.xlsx', (v) => sent.push(v)),
          exportMock('pdf', 'comercial.pdf', (v) => sent.push(v)),
        ]}
      >
        <ReportsPage />
      </MockedProvider>,
    );
    await screen.findByText('Motivos de perda');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
    await waitFor(() => expect(clicked).toContain('comercial.xlsx'));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));
    await waitFor(() => expect(clicked).toContain('comercial.pdf'));
    expect(created).toHaveLength(2);
    expect(created[0]!.size).toBe(3);
    expect(sent).toHaveLength(2);
  });
});

describe('downloadBase64File', () => {
  it('cria o link com o nome e revoga a URL depois', async () => {
    const revoked: string[] = [];
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:y';
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = (u) => {
      revoked.push(u);
    };
    let name = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    downloadBase64File('a.pdf', 'application/pdf', 'AQID');
    expect(name).toBe('a.pdf');
    await waitFor(() => expect(revoked).toEqual(['blob:y']));
  });
});
