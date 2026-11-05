import { validateCpf } from '../../clients/cpf.util';

export type MissingTarget = 'client' | 'group' | 'contract' | 'settings';
export interface MissingField {
  code: string;
  label: string;
  target: MissingTarget;
  targetId: string | null;
}
export interface ReadinessInput {
  kind: 'noiva' | 'debutante';
  groupId: string;
  contractId: string;
  contractor: {
    clientId: string;
    fullName: string | null;
    cpf: string | null;
    address: string | null;
    phone: string | null;
    phone2: string | null;
  } | null;
  eventDate: string | null;
  eventTime: string | null;
  hasPackage: boolean;
  paymentMode: 'sinal' | 'sinal_parcelado' | 'a_vista';
  depositCents: number;
  studio: {
    name: string | null;
    cnpj: string | null;
    representative: string | null;
    address: string | null;
    forumCity: string | null;
    forumUf: string | null;
  };
}

const blank = (s: string | null | undefined): boolean => !s || s.trim() === '';

/** Pendências para gerar o link do contrato (D-09). RG do representante é opcional. */
export function missingRequiredFields(i: ReadinessInput): MissingField[] {
  const out: MissingField[] = [];
  const c = i.contractor;

  if (c === null) {
    if (i.kind === 'debutante') {
      out.push({
        code: 'RESPONSIBLE_MISSING',
        label: 'Responsável pela debutante',
        target: 'group',
        targetId: i.groupId,
      });
    }
  } else {
    const client = (code: string, label: string) =>
      out.push({ code, label, target: 'client', targetId: c.clientId });
    if (blank(c.fullName)) client('CONTRACTOR_NAME', 'Nome da contratante');
    if (blank(c.cpf) || !validateCpf(c.cpf)) client('CONTRACTOR_CPF', 'CPF da contratante');
    if (blank(c.address)) client('CONTRACTOR_ADDRESS', 'Endereço da contratante');
    if (blank(c.phone)) client('CONTRACTOR_PHONE1', 'Celular 1 da contratante');
    if (blank(c.phone2)) client('CONTRACTOR_PHONE2', 'Celular 2 da contratante');
  }

  if (blank(i.eventDate)) {
    out.push({ code: 'EVENT_DATE', label: 'Data do evento', target: 'group', targetId: i.groupId });
  }
  if (blank(i.eventTime)) {
    out.push({ code: 'EVENT_TIME', label: 'Horário do evento', target: 'group', targetId: i.groupId });
  }
  if (!i.hasPackage) {
    out.push({ code: 'PACKAGE', label: 'Pacote contratado', target: 'contract', targetId: i.contractId });
  }
  if (i.paymentMode !== 'a_vista' && i.depositCents <= 0) {
    out.push({ code: 'DEPOSIT_ZERO', label: 'Valor do sinal', target: 'contract', targetId: i.contractId });
  }

  const s = i.studio;
  const studioMissing = [
    blank(s.name) && 'nome',
    blank(s.cnpj) && 'CNPJ',
    blank(s.address) && 'endereço',
    blank(s.representative) && 'representante',
    blank(s.forumCity) && 'cidade do foro',
    blank(s.forumUf) && 'UF do foro',
  ].filter((x): x is string => x !== false);
  if (studioMissing.length > 0) {
    out.push({
      code: 'STUDIO_DATA',
      label: `Dados do studio: ${studioMissing.join(', ')}`,
      target: 'settings',
      targetId: null,
    });
  }
  return out;
}

export function formatMissingMessage(missing: MissingField[]): string {
  return `Faltam dados para gerar o link: ${missing.map((m) => m.label).join(', ')}.`;
}
