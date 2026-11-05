import { unmaskCurrency } from '@/features/catalog/utils/currency-mask';
import { centsToDecimal } from '@/features/operations/lib/money';
import { BRIDE_DRAFT_ID, type NewGroupResult } from './new-contract';

/** base64 -> Blob (PDF do "Baixar PDF" e da prévia). */
export function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export interface ContractFormItemDraft {
  groupMemberId: string;
  serviceId: string;
  /** mascarado "80,00" */
  unitPrice: string;
  quantity: number;
  purpose: string;
  packageItem: boolean;
}

/** Estado do formulário de contrato que vai ao backend (salvar ou prévia). */
export interface ContractFormState {
  /** Edição de um contrato existente. */
  contractId?: string | null;
  /** Criação a partir de um grupo existente (?grupo=). */
  groupId?: string | null;
  /** Novo contrato sem grupo: resultado de buildNewGroupInput (o grupo nasce junto). */
  newGroup?: NewGroupResult | null;
  items: ContractFormItemDraft[];
  packageId: string;
  /** Criação com pacote: os itens da noiva vêm do pacote e não são enviados. */
  packageDriven: boolean;
  /** mascarado "300,00" ou vazio */
  discount: string;
  discountDescription: string;
  paymentMode: string;
  depositCents: number;
  installments: { dueDate: string; cents: number | null }[];
  /** prazo do restante digitado ("" = padrão das configurações) */
  days: string;
}

export type ContractSaveInput =
  | { kind: 'update'; id: string; input: Record<string, unknown> }
  | { kind: 'create'; input: Record<string, unknown> }
  | { kind: 'incomplete'; error: string };

/**
 * Única fonte do que o formulário manda ao backend: o "Salvar" e a prévia usam o
 * mesmo input (prévia = o que seria salvo).
 */
export function buildContractSaveInput(s: ContractFormState): ContractSaveInput {
  const items = s.items.map((i) => ({
    groupMemberId: i.groupMemberId === BRIDE_DRAFT_ID ? undefined : i.groupMemberId,
    serviceId: i.serviceId,
    unitPrice: unmaskCurrency(i.unitPrice) || '0.00',
    quantity: i.quantity,
    purpose: i.purpose,
    packageItem: i.packageItem,
  }));
  const common = {
    packageId: s.packageId || undefined,
    discountAmount: s.discount ? unmaskCurrency(s.discount) : '0.00',
    depositAmount: s.depositCents > 0 ? centsToDecimal(s.depositCents) : undefined,
    paymentMode: s.paymentMode,
    discountDescription: s.discountDescription.trim() || null,
    installments: s.installments.map((r) => ({
      dueDate: r.dueDate,
      amount: centsToDecimal(r.cents ?? 0),
    })),
    balanceDueDaysBefore: s.days !== '' ? Number(s.days) : undefined,
  };
  if (s.contractId) {
    return { kind: 'update', id: s.contractId, input: { ...common, items } };
  }
  let target: Record<string, unknown>;
  if (s.newGroup) {
    if (!s.newGroup.ok) return { kind: 'incomplete', error: s.newGroup.error };
    target = { newGroup: s.newGroup.input };
  } else if (s.groupId) {
    target = { groupId: s.groupId };
  } else {
    return { kind: 'incomplete', error: 'Informe o grupo do contrato.' };
  }
  return {
    kind: 'create',
    input: { ...target, ...common, ...(s.packageDriven ? {} : { items }) },
  };
}

/** Input da query contractPreviewPdf; null enquanto falta a cliente/data do novo contrato. */
export function buildContractPreviewInput(s: ContractFormState): Record<string, unknown> | null {
  const r = buildContractSaveInput(s);
  if (r.kind === 'incomplete') return null;
  return r.kind === 'update' ? { contractId: r.id, ...r.input } : r.input;
}
