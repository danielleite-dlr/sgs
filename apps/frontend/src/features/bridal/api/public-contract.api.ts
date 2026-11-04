/**
 * Cliente REST da rota pública de aceite do contrato (sem Apollo, sem autenticação).
 * Backend: GET/POST /public/contracts/:orgId/:token[/accept|/pdf].
 */

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
