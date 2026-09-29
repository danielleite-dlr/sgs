import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mesmo diretório que scripts/e2e-env.mjs entrega ao backend (EMAIL_OUTBOX_DIR).
export const OUTBOX_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '.e2e-state',
  'outbox',
);

interface OutboxEmail {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  sentAt: string;
}

async function readOutbox(): Promise<{ file: string; email: OutboxEmail }[]> {
  let files: string[];
  try {
    files = (await readdir(OUTBOX_DIR)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
  const out: { file: string; email: OutboxEmail }[] = [];
  for (const file of files) {
    try {
      out.push({
        file,
        email: JSON.parse(await readFile(join(OUTBOX_DIR, file), 'utf8')),
      });
    } catch {
      // arquivo ainda sendo escrito; próxima volta do polling pega
    }
  }
  return out;
}

/** Espera o e-mail de convite mais recente para `email` e extrai o token de /convite/:token. */
export async function waitForInvitationToken(
  email: string,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const wanted = email.toLowerCase();
  do {
    const matches = (await readOutbox()).filter(
      (m) => m.email.to.toLowerCase() === wanted,
    );
    const latest = matches[matches.length - 1];
    if (latest) {
      const source = latest.email.text ?? latest.email.html ?? '';
      const found =
        /\/convite\/([^\s"<?]+)/.exec(source) ??
        /\/convite\/([^\s"<?]+)/.exec(latest.email.html ?? '');
      if (found) return decodeURIComponent(found[1]);
    }
    await new Promise((r) => setTimeout(r, 250));
  } while (Date.now() < deadline);
  throw new Error(`Nenhum e-mail de convite para ${email} em ${OUTBOX_DIR}`);
}
