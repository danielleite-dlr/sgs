// Mock data for ComandaPage (POS) — Phase 3 mockup
// No real backend integration — static data only

export interface MockComandaItem {
  id: string;
  name: string;
  type: 'service' | 'product';
  professional?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface MockComanda {
  id: string;
  clientName: string;
  clientPhone: string;
  openedAt: string;
  status: 'open' | 'closed';
  items: MockComandaItem[];
}

export const MOCK_COMANDA: MockComanda = {
  id: 'demo',
  clientName: 'Maria da Silva',
  clientPhone: '(11) 98765-4321',
  openedAt: '2026-05-04T10:30:00Z',
  status: 'open',
  items: [
    { id: 'i1', name: 'Corte Feminino', type: 'service', professional: 'Ana Souza',  quantity: 1, unitPrice: 8000, total: 8000 },
    { id: 'i2', name: 'Escova',         type: 'service', professional: 'Ana Souza',  quantity: 1, unitPrice: 5000, total: 5000 },
    { id: 'i3', name: 'Shampoo Hidrat.', type: 'product',                            quantity: 1, unitPrice: 3500, total: 3500 },
  ],
};

export const PAYMENT_METHODS = [
  { value: 'pix',      label: 'Pix' },
  { value: 'credit',   label: 'Cartão de Crédito' },
  { value: 'debit',    label: 'Cartão de Débito' },
  { value: 'cash',     label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'voucher',  label: 'Voucher' },
];

/** Format cents as BRL string: 8000 → "R$ 80,00" */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function comandaTotal(comanda: MockComanda): number {
  return comanda.items.reduce((sum, item) => sum + item.total, 0);
}
