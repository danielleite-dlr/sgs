import { normalizeBrPhone } from '@/features/identity/member-validation';
import type { BridalPersonInput } from '../api/bridal.api';

export interface PersonDraft {
  mode: 'existing' | 'new';
  clientId: string;
  clientName: string;
  newName: string;
  newPhone: string;
  relationLabel: string;
  coveredByContract: boolean;
  services: { serviceId: string; purpose: 'event' | 'trial' }[];
}

export function emptyPerson(isBride: boolean): PersonDraft {
  return {
    mode: 'new',
    clientId: '',
    clientName: '',
    newName: '',
    newPhone: '',
    relationLabel: '',
    coveredByContract: isBride, // D-06/D-07: noiva incluída, acompanhantes avulsas por padrão
    services: [],
  };
}

export type PersonResult = { ok: true; input: BridalPersonInput } | { ok: false; error: string };

export function buildPersonInput(p: PersonDraft, label: string): PersonResult {
  const base: BridalPersonInput = {
    coveredByContract: p.coveredByContract,
    services: p.services.map((s) => ({ serviceId: s.serviceId, purpose: s.purpose })),
  };
  const relation = p.relationLabel.trim();
  if (relation) base.relationLabel = relation;
  if (p.mode === 'existing') {
    if (!p.clientId) return { ok: false, error: `${label}: escolha a cliente.` };
    return { ok: true, input: { ...base, clientId: p.clientId } };
  }
  const fullName = p.newName.trim();
  if (fullName.length < 2) return { ok: false, error: `${label}: informe o nome.` };
  const phoneRaw = p.newPhone.trim();
  let phone: string | undefined;
  if (phoneRaw) {
    const normalized = normalizeBrPhone(phoneRaw);
    if (!normalized) return { ok: false, error: `${label}: telefone inválido (use DDD).` };
    phone = normalized;
  }
  return { ok: true, input: { ...base, newClient: { fullName, ...(phone ? { phone } : {}) } } };
}
