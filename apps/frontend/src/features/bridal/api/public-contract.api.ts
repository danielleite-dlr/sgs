/**
 * Cliente REST da rota pública de aceite do contrato (sem Apollo, sem autenticação).
 * Backend: GET/POST /public/contracts/:orgId/:token[/accept|/pdf].
 */

export interface ContractSnapshot {
  format: 2;
  code: string;
  kind: 'noiva' | 'debutante';
  generatedOn: string;
  studio: {
    name: string;
    cnpj: string;
    address: string;
    representative: string;
    representativeRg: string;
    forumCity: string;
    forumUf: string;
  };
  letterhead: { sha256: string; mimeType: string } | null;
  texts: { title: string; intro: string; parties: string; trialNote: string; clauses: string };
  contractor: {
    name: string;
    cpf: string;
    rg: string;
    address: string;
    postalCode: string;
    email: string;
    phone1: string;
    phone2: string;
    phone3: string;
  };
  debutanteName: string | null;
  event: { date: string; time: string; locationName: string; serviceAddress: string };
  budget: {
    package: { name: string; description: string | null; cents: number } | null;
    extras: { label: string; cents: number }[];
    discount: { label: string; cents: number } | null;
    totalCents: number;
  };
  payment: {
    mode: 'sinal' | 'sinal_parcelado' | 'a_vista';
    installments: { seq: number; dueDate: string; cents: number }[];
    balanceDueDaysBefore: number | null;
  };
}

export interface PublicContract {
  orgName: string;
  code: string;
  eventDate: string;
  version: number;
  text: string;
  textSha256: string;
  accepted: boolean;
  acceptedAt: string | null;
  acceptedName: string | null;
  isCurrentVersion: boolean;
  expiresAt: string;
  /** Snapshot estruturado (null em versões legadas, exibidas como texto corrido). */
  snapshot: ContractSnapshot | null;
}

export interface AcceptBody {
  fullName: string;
  cpf: string;
  accepted: boolean;
  textSha256: string;
}

export class PublicContractError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PublicContractError';
  }
}

const base = (): string => import.meta.env.VITE_API_URL ?? '';

function path(orgId: string, token: string, suffix = ''): string {
  return `${base()}/public/contracts/${encodeURIComponent(orgId)}/${encodeURIComponent(token)}${suffix}`;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let code = 'ERROR';
  let message = 'Não foi possível concluir a operação.';
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    if (body.code) code = body.code;
    if (typeof body.message === 'string') message = body.message;
  } catch {
    // corpo não-JSON (ex.: 429 do proxy): mantém mensagem padrão
  }
  throw new PublicContractError(res.status, code, message);
}

export async function fetchPublicContract(orgId: string, token: string): Promise<PublicContract> {
  const res = await fetch(path(orgId, token), { headers: { Accept: 'application/json' } });
  return parse<PublicContract>(res);
}

export async function acceptPublicContract(
  orgId: string,
  token: string,
  body: AcceptBody,
): Promise<{ accepted: true; acceptedAt: string }> {
  const res = await fetch(path(orgId, token, '/accept'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return parse<{ accepted: true; acceptedAt: string }>(res);
}

export function publicContractPdfUrl(orgId: string, token: string): string {
  return path(orgId, token, '/pdf');
}
