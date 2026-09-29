import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EmailAdapter, SendEmailParams } from "./resend.adapter";

/**
 * Only dev/test/E2E: the invitation token exists in the database only as a
 * SHA-256 hash, so an E2E run can only obtain the invitation link by capturing
 * the outgoing email. Each email becomes one JSON file in `dir`.
 * Never enabled when NODE_ENV=production (see shouldUseOutbox).
 */
export class FileOutboxEmailAdapter implements EmailAdapter {
  constructor(private readonly dir: string) {}

  async send(params: SendEmailParams): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, `${Date.now()}-${randomUUID()}.json`);
    await writeFile(
      file,
      JSON.stringify({ ...params, sentAt: new Date().toISOString() }),
    );
  }
}

export function shouldUseOutbox(
  nodeEnv: string | undefined,
  outboxDir: string | undefined,
): boolean {
  return (
    nodeEnv !== "production" &&
    typeof outboxDir === "string" &&
    outboxDir.trim().length > 0
  );
}
