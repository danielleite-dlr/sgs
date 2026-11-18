/**
 * Cliente REST do formulário público do Comercial (sem Apollo, sem autenticação).
 * Backend: GET/POST /public/leads/:orgId/:token.
 */

export interface PublicLeadForm {
  orgName: string;
  consentText: string;
  consentTextVersion: string;
  successMessage: string | null;
}

export interface PublicLeadBody {
  fullName: string;
  phone: string;
  email?: string;
  kind: 'noiva' | 'debutante';
  eventDate?: string;
  message?: string;
  consent: true;
  website: string;
}

export class PublicLeadError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PublicLeadError';
  }
}

const base = (): string => import.meta.env.VITE_API_URL ?? '';

function path(orgId: string, token: string): string {
  return `${base()}/public/leads/${encodeURIComponent(orgId)}/${encodeURIComponent(token)}`;
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
    // corpo não-JSON (ex.: 429 do proxy): mantém a mensagem padrão
  }
  throw new PublicLeadError(res.status, code, message);
}

export async function fetchPublicLeadForm(orgId: string, token: string): Promise<PublicLeadForm> {
  const res = await fetch(path(orgId, token), { headers: { Accept: 'application/json' } });
  return parse<PublicLeadForm>(res);
}

export async function submitPublicLead(
  orgId: string,
  token: string,
  body: PublicLeadBody,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(path(orgId, token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return parse<{ ok: boolean; message: string }>(res);
}
