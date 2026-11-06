import type { ContractMissingField } from '../api/contracts.api';

export type ClientField = 'fullName' | 'cpf' | 'address' | 'phone' | 'phone2';

/** Códigos do gate D-09 (backend contract-required-fields.ts) que se resolvem na ficha da cliente. */
const FIELD_BY_CODE: Record<string, { field: ClientField; label: string }> = {
  CONTRACTOR_NAME: { field: 'fullName', label: 'Nome completo' },
  CONTRACTOR_CPF: { field: 'cpf', label: 'CPF' },
  CONTRACTOR_ADDRESS: { field: 'address', label: 'Endereço' },
  CONTRACTOR_PHONE1: { field: 'phone', label: 'Celular 1' },
  CONTRACTOR_PHONE2: { field: 'phone2', label: 'Celular 2' },
};

/** Campos da contratante que o diálogo sabe completar, na ordem do formulário. */
export function contractorFieldsFor(missing: ContractMissingField[]) {
  const codes = new Set(missing.filter((m) => m.target === 'client').map((m) => m.code));
  return Object.entries(FIELD_BY_CODE)
    .filter(([code]) => codes.has(code))
    .map(([, f]) => f);
}
