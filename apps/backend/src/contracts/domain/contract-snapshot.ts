import { formatBRL, formatDateBR, sha256Hex } from './contract-template';

export const SNAPSHOT_FORMAT = 2 as const;

export type ContractKind = 'noiva' | 'debutante';
export type PaymentMode = 'sinal' | 'sinal_parcelado' | 'a_vista';

export interface SnapshotStudio {
  name: string;
  cnpj: string;
  address: string;
  representative: string;
  representativeRg: string;
  forumCity: string;
  forumUf: string;
}
/** Textos já com as variáveis aplicadas. */
export interface SnapshotTexts {
  title: string;
  intro: string;
  parties: string;
  trialNote: string;
  clauses: string;
}
export interface SnapshotContractor {
  name: string;
  cpf: string;
  rg: string;
  address: string;
  postalCode: string;
  email: string;
  phone1: string;
  phone2: string;
  phone3: string;
}
export interface SnapshotInstallment {
  seq: number;
  dueDate: string;
  cents: number;
}
export interface ContractSnapshot {
  format: 2;
  code: string;
  kind: ContractKind;
  /** YYYY-MM-DD no fuso da org. */
  generatedOn: string;
  studio: SnapshotStudio;
  letterhead: { sha256: string; mimeType: string } | null;
  texts: SnapshotTexts;
  contractor: SnapshotContractor;
  debutanteName: string | null;
  event: { date: string; time: string; locationName: string; serviceAddress: string };
  budget: {
    package: { name: string; description: string | null; cents: number } | null;
    extras: { label: string; cents: number }[];
    discount: { label: string; cents: number } | null;
    totalCents: number;
  };
  payment: {
    mode: PaymentMode;
    installments: SnapshotInstallment[];
    balanceDueDaysBefore: number | null;
  };
}

export interface SnapshotItemInput {
  serviceName: string;
  personLabel: string;
  purpose: 'event' | 'trial';
  quantity: number;
  totalCents: number;
  isPackageItem: boolean;
  sortOrder: number;
}
export interface SnapshotInput {
  code: string;
  kind: ContractKind;
  generatedOn: string;
  studio: SnapshotStudio;
  letterhead: { sha256: string; mimeType: string } | null;
  texts: SnapshotTexts;
  contractor: {
    name: string | null;
    cpf: string | null;
    rg: string | null;
    address: string | null;
    postalCode: string | null;
    email: string | null;
    phone1: string | null;
    phone2: string | null;
    phone3: string | null;
  };
  debutanteName: string | null;
  event: {
    date: string;
    time: string | null;
    locationName: string | null;
    serviceAddress: string | null;
  };
  package: { name: string; description: string | null } | null;
  items: SnapshotItemInput[];
  discount: { cents: number; description: string | null };
  totalCents: number;
  payment: {
    mode: PaymentMode;
    installments: SnapshotInstallment[];
    balanceDueDaysBefore: number;
  };
}

function formatCpf(cpf: string | null): string {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function extraLabel(i: SnapshotItemInput): string {
  return (
    'Serviço Adicional: ' +
    i.serviceName +
    (i.quantity > 1 ? ` × ${i.quantity}` : '') +
    ` – ${i.personLabel}` +
    (i.purpose === 'trial' ? ' (teste)' : '')
  );
}

export function buildSnapshot(input: SnapshotInput): ContractSnapshot {
  const items = [...input.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const pkgItems = input.package ? items.filter((i) => i.isPackageItem) : [];
  const extraItems = input.package ? items.filter((i) => !i.isPackageItem) : items;

  const pkg = input.package
    ? {
        name: input.package.name,
        description: input.package.description,
        cents: pkgItems.reduce((a, i) => a + i.totalCents, 0),
      }
    : null;
  const extras = extraItems.map((i) => ({ label: extraLabel(i), cents: i.totalCents }));
  const discount =
    input.discount.cents > 0
      ? { label: input.discount.description?.trim() || 'Desconto', cents: input.discount.cents }
      : null;

  const computed =
    (pkg?.cents ?? 0) + extras.reduce((a, e) => a + e.cents, 0) - (discount?.cents ?? 0);
  if (computed !== input.totalCents) throw new RangeError('SNAPSHOT_TOTAL_MISMATCH');

  const c = input.contractor;
  return {
    format: SNAPSHOT_FORMAT,
    code: input.code,
    kind: input.kind,
    generatedOn: input.generatedOn,
    studio: { ...input.studio },
    letterhead: input.letterhead ? { ...input.letterhead } : null,
    texts: { ...input.texts },
    contractor: {
      name: c.name ?? '',
      cpf: formatCpf(c.cpf),
      rg: c.rg ?? '',
      address: c.address ?? '',
      postalCode: c.postalCode ?? '',
      email: c.email ?? '',
      phone1: c.phone1 ?? '',
      phone2: c.phone2 ?? '',
      phone3: c.phone3 ?? '',
    },
    debutanteName: input.debutanteName,
    event: {
      date: input.event.date,
      time: input.event.time ?? '',
      locationName: input.event.locationName ?? '',
      serviceAddress: input.event.serviceAddress ?? '',
    },
    budget: { package: pkg, extras, discount, totalCents: input.totalCents },
    payment: {
      mode: input.payment.mode,
      installments: [...input.payment.installments]
        .sort((a, b) => a.seq - b.seq)
        .map((i) => ({ seq: i.seq, dueDate: i.dueDate, cents: i.cents })),
      balanceDueDaysBefore:
        input.payment.mode === 'a_vista' ? null : input.payment.balanceDueDaysBefore,
    },
  };
}

/** JSON canônico: chaves ordenadas recursivamente, undefined omitido, sem espaços. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') {
    return JSON.stringify(v) ?? 'null';
  }
  if (Array.isArray(v)) {
    return `[${v.map((x) => (x === undefined ? 'null' : canonicalJson(x))).join(',')}]`;
  }
  const obj = v as Record<string, unknown>;
  const parts = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${parts.join(',')}}`;
}

export function snapshotHash(s: ContractSnapshot): string {
  return sha256Hex(canonicalJson(s));
}

function installmentLine(s: ContractSnapshot, i: SnapshotInstallment): string {
  const { mode, installments } = s.payment;
  let label: string;
  if (mode === 'a_vista') label = 'À VISTA';
  else if (mode === 'sinal') label = 'SINAL';
  else label = `SINAL ${i.seq}/${installments.length}`;
  return `${label} · ${formatDateBR(i.dueDate)} · ${formatBRL(i.cents)}`;
}

/** Versão em texto puro (acessibilidade / conferência). */
export function snapshotToPlainText(s: ContractSnapshot): string {
  const lines: string[] = [s.texts.title, ''];
  lines.push(`Contratada: ${s.studio.name} — CNPJ ${s.studio.cnpj}`);
  lines.push(`Contratante: ${s.contractor.name}`);
  if (s.contractor.cpf) lines.push(`CPF: ${s.contractor.cpf}`);
  if (s.debutanteName) lines.push(`Debutante: ${s.debutanteName}`);
  lines.push('', s.texts.intro, s.texts.parties, '');
  lines.push(`Data do evento: ${formatDateBR(s.event.date)} ${s.event.time}`.trim());
  if (s.event.locationName) lines.push(`Local: ${s.event.locationName}`);
  if (s.event.serviceAddress) lines.push(`Endereço do serviço: ${s.event.serviceAddress}`);
  lines.push('');
  if (s.budget.package) {
    lines.push(`Pacote contratado: ${s.budget.package.name} — ${formatBRL(s.budget.package.cents)}`);
    if (s.budget.package.description) lines.push(s.budget.package.description);
  }
  for (const e of s.budget.extras) lines.push(`${e.label} — ${formatBRL(e.cents)}`);
  if (s.budget.discount) {
    lines.push(`${s.budget.discount.label} — -${formatBRL(s.budget.discount.cents)}`);
  }
  lines.push(`Total: ${formatBRL(s.budget.totalCents)}`, '');
  for (const i of s.payment.installments) lines.push(installmentLine(s, i));
  if (s.payment.balanceDueDaysBefore !== null) {
    lines.push(`Saldo restante até ${s.payment.balanceDueDaysBefore} dias antes do evento.`);
  }
  lines.push('', s.texts.trialNote, '', s.texts.clauses.replace(/\*\*/g, ''));
  lines.push('', `${s.studio.forumCity}/${s.studio.forumUf}, ${formatDateBR(s.generatedOn)}`);
  return lines.join('\n');
}
