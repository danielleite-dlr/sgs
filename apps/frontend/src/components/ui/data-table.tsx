import * as React from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Button } from './button';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;
export type SortState<TKey extends string = string> = { key: TKey; direction: SortDirection } | null;

export interface DataTableColumn<TRow, TKey extends string = string> {
  key: TKey;
  header: string; // 14px weight 600 muted color (UI-SPEC §Typography)
  sortable?: boolean;
  cell: (row: TRow) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<TRow, TKey extends string = string> {
  columns: DataTableColumn<TRow, TKey>[];
  rows: TRow[];
  rowKey: (row: TRow) => string;
  loading?: boolean;
  empty?: React.ReactNode;
  sort?: SortState<TKey>;
  onSortChange?: (next: SortState<TKey>) => void;
  onRowClick?: (row: TRow) => void;
  page?: number; // 1-based
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
}

export function DataTable<TRow, TKey extends string = string>(
  props: DataTableProps<TRow, TKey>,
) {
  const {
    columns,
    rows,
    rowKey,
    loading,
    empty,
    sort,
    onSortChange,
    onRowClick,
    page = 1,
    pageSize = 20,
    totalCount = rows.length,
    onPageChange,
  } = props;

  function toggleSort(key: TKey) {
    if (!onSortChange) return;
    if (!sort || sort.key !== key) onSortChange({ key, direction: 'asc' });
    else if (sort.direction === 'asc') onSortChange({ key, direction: 'desc' });
    else onSortChange(null);
  }

  if (loading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className="text-label text-neutral-500">
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c.key}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (rows.length === 0 && empty) {
    return <div className="py-2xl">{empty}</div>;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showPagination = totalCount > pageSize;
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-md">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => {
              const isSorted = sort?.key === c.key;
              const Icon = !isSorted
                ? ArrowUpDown
                : sort?.direction === 'asc'
                  ? ChevronUp
                  : ChevronDown;
              return (
                <TableHead
                  key={c.key}
                  className={cn('text-label text-neutral-500', c.className)}
                  aria-sort={
                    isSorted
                      ? sort?.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-xs font-semibold"
                    >
                      {c.header}
                      <Icon className="h-4 w-4" />
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-neutral-50' : undefined}
            >
              {columns.map((c) => (
                <TableCell key={c.key} className={c.className}>
                  {c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {showPagination && (
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>
            {rangeStart}–{rangeEnd} de {totalCount} resultados
          </span>
          <div className="flex items-center gap-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            >
              Anterior
            </Button>
            <span className="px-sm py-xs rounded bg-primary-500 text-white text-sm font-semibold">
              {page}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
