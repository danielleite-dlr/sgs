import { buildPersonInput, emptyPerson, type PersonDraft } from './person-draft';
import type { BridalPersonInput } from '../api/bridal.api';

/** Id do membro-rascunho da noiva/debutante enquanto o grupo ainda não existe. */
export const BRIDE_DRAFT_ID = 'nova-noiva';

export interface NewContractValue {
  eventKind: 'noiva' | 'debutante';
  bride: PersonDraft;
  responsible: PersonDraft;
  eventDate: string;
  eventTime: string;
}

export function emptyNewContract(): NewContractValue {
  return {
    eventKind: 'noiva',
    bride: emptyPerson(true),
    responsible: emptyPerson(false),
    eventDate: '',
    eventTime: '',
  };
}

/** Nome da noiva/debutante como digitado ou escolhido (vazio se ainda não informou). */
export function newContractBrideName(v: NewContractValue): string {
  return v.bride.mode === 'existing' ? v.bride.clientName.trim() : v.bride.newName.trim();
}

export interface NewGroupPayload {
  eventKind: 'noiva' | 'debutante';
  eventDate: string;
  eventTime?: string;
  bride: BridalPersonInput;
  responsibleClientId?: string;
  newResponsible?: { fullName: string; phone?: string };
}

export type NewGroupResult = { ok: true; input: NewGroupPayload } | { ok: false; error: string };

/** O que falta preencher (texto pt-BR) ou o input pronto para a API. */
export function buildNewGroupInput(v: NewContractValue): NewGroupResult {
  const debutante = v.eventKind === 'debutante';
  const bride = buildPersonInput(v.bride, debutante ? 'Debutante' : 'Noiva');
  if (!bride.ok) return bride;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.eventDate)) {
    return { ok: false, error: 'Informe a data do evento.' };
  }
  const input: NewGroupPayload = {
    eventKind: v.eventKind,
    eventDate: v.eventDate,
    // a noiva vem só com o cadastro; os serviços entram pelos itens do contrato
    bride: { ...bride.input, coveredByContract: true, services: [] },
  };
  if (v.eventTime) input.eventTime = v.eventTime;
  if (debutante) {
    const resp = buildPersonInput(v.responsible, 'Responsável');
    if (!resp.ok) return resp;
    if (resp.input.clientId) input.responsibleClientId = resp.input.clientId;
    if (resp.input.newClient) input.newResponsible = resp.input.newClient;
  }
  return { ok: true, input };
}
