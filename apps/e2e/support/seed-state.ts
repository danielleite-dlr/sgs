import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gql } from './graphql';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '.e2e-state',
);
const STATE_FILE = join(STATE_DIR, 'seed.json');

export interface SeedUser {
  email: string;
  password: string;
  name: string;
  memberId?: string;
}

export interface SeedState {
  suffix: string;
  orgId: string;
  owner: SeedUser;
  manager: SeedUser;
  attendant: SeedUser;
  proBlocked: SeedUser;
  proEditable: SeedUser;
  appointment: {
    id: string;
    clientName: string;
    serviceName: string;
    startsAt: string;
    endsAt: string;
  };
}

export function writeSeedState(state: SeedState): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function readSeedState(): SeedState {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as SeedState;
}

/** Login via API, devolvendo o access token (para chamadas diretas nos specs). */
export async function apiLogin(email: string, password: string): Promise<string> {
  const data = await gql<{
    login: { accessToken: string | null; errors: { message: string }[] };
  }>(
    `mutation($input: LoginInput!) { login(input: $input) { accessToken errors { code message } } }`,
    { input: { email, password } },
  );
  if (!data.login.accessToken) {
    throw new Error(`login ${email} falhou: ${JSON.stringify(data.login.errors)}`);
  }
  return data.login.accessToken;
}
