import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DataTable } from '../data-table';

describe('DataTable', () => {
  it('renders rows with column cells', () => {
    render(
      <DataTable
        rowKey={(r: { id: string; name: string }) => r.id}
        rows={[
          { id: '1', name: 'Ana' },
          { id: '2', name: 'Beto' },
        ]}
        columns={[
          { key: 'name', header: 'Nome', cell: (r) => r.name },
        ]}
      />,
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
    expect(screen.getByText('Nome')).toBeInTheDocument();
  });

  it('shows pagination when totalCount > pageSize', () => {
    render(
      <DataTable
        rowKey={(r: { id: string }) => r.id}
        rows={[{ id: '1' }]}
        columns={[{ key: 'id', header: 'ID', cell: (r) => r.id }]}
        totalCount={50}
        pageSize={20}
      />,
    );
    expect(screen.getByText(/de 50 resultados/)).toBeInTheDocument();
  });
});
