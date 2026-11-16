export interface FcmServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Lê a service account do Firebase a partir de base64 de JSON. Nunca lança. */
export function parseFcmServiceAccount(raw: string | undefined): FcmServiceAccount | null {
  if (!raw || !raw.trim()) return null;
  try {
    const json = JSON.parse(Buffer.from(raw.trim(), 'base64').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (!nonEmpty(json.project_id) || !nonEmpty(json.client_email) || !nonEmpty(json.private_key)) {
      return null;
    }
    return {
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    };
  } catch {
    return null;
  }
}
