import { gql, expectNoUserErrors } from './graphql';
import { apiLogin, type SeedState } from './seed-state';

export const TZ = 'America/Sao_Paulo';

/** Data local (YYYY-MM-DD) em São Paulo, `offsetDays` dias a partir de agora. */
export function spDate(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );
}

/** Dias de hoje até a próxima quarta-feira (1..7, sempre no futuro). */
export function daysUntilNextWednesday(): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(
    new Date(),
  );
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const diff = (3 - index + 7) % 7;
  return diff === 0 ? 7 : diff;
}

/** Instante ISO de um horário local de SP (UTC-3, sem horário de verão). */
export function spInstant(ymd: string, hhmm: string): string {
  return `${ymd}T${hhmm}:00-03:00`;
}

/** "80.00" -> "R$ 80,00" com espaços normalizados (o Intl usa NBSP). */
export function brl(decimal: string | number): string {
  const n = typeof decimal === 'string' ? Number(decimal) : decimal;
  return normalizeSpaces(
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n),
  );
}

export function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Soma decimais em centavos (evita erro de ponto flutuante). */
export function addMoney(...values: (string | number)[]): string {
  const cents = values.reduce<number>((acc, v) => acc + Math.round(Number(v) * 100), 0);
  return (cents / 100).toFixed(2);
}

export interface Actor {
  token: string;
}

export async function ownerToken(seed: SeedState): Promise<string> {
  return apiLogin(seed.owner.email, seed.owner.password);
}

export interface CreatedPro {
  id: string;
  name: string;
  email: string;
  password: string;
}

/**
 * Cria um profissional exclusivo do spec (via API) com senha já trocada.
 * Raias novas por spec/repetição isolam os horários entre specs.
 */
export async function createProfessional(
  seed: SeedState,
  token: string,
  label: string,
): Promise<CreatedPro> {
  const unique = `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const email = `e2e-${unique}@example.com`;
  const name = `E2E ${label} ${unique.slice(-6)}`;
  const data = await gql<{
    createMember: { member: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateMemberInput!) {
      createMember(input: $input) { member { id } errors { code message } }
    }`,
    {
      input: {
        displayName: name,
        email,
        phone: '(11) 91234-5699',
        pixKey: email,
        roleName: 'PROFESSIONAL',
        isProfessional: true,
        categoryIds: [seed.phase3.categoryId],
        temporaryPassword: 'Prov#Temp2026',
      },
    },
    { token },
  );
  expectNoUserErrors(data.createMember, `createMember ${name}`);
  const first = await apiLogin(email, 'Prov#Temp2026');
  const changed = await gql<{ changePassword: { success: boolean; errors: never[] } }>(
    `mutation($input: ChangePasswordInput!) {
      changePassword(input: $input) { success errors { code message } }
    }`,
    {
      input: { currentPassword: 'Prov#Temp2026', newPassword: seed.owner.password },
    },
    { token: first },
  );
  expectNoUserErrors(changed.changePassword, `changePassword ${name}`);
  return { id: data.createMember.member!.id, name, email, password: seed.owner.password };
}

const VISIT = `mutation($input: CreateVisitInput!) {
  createVisit(input: $input) {
    comandaId
    appointments { id professionalId startsAt endsAt }
    errors { code message }
  }
}`;

export interface VisitResult {
  comandaId: string | null;
  appointments: { id: string; professionalId: string }[];
  errors: { code: string; message: string }[];
}

/** createVisit de um único serviço. Não lança em erro de domínio: devolve `errors`. */
export async function createVisit(
  token: string,
  args: {
    clientId: string;
    serviceId: string;
    professionalId: string;
    startsAt: string;
    endsAt: string;
    deposit?: { amount: string; method: string };
  },
): Promise<VisitResult> {
  const data = await gql<{ createVisit: VisitResult }>(
    VISIT,
    {
      input: {
        clientId: args.clientId,
        deposit: args.deposit,
        items: [
          {
            serviceId: args.serviceId,
            professionalId: args.professionalId,
            startsAt: args.startsAt,
            endsAt: args.endsAt,
          },
        ],
      },
    },
    { token },
  );
  return data.createVisit;
}

export interface Summary {
  billedTotal: string;
  receivedTotal: string;
  receivedByMethod: { method: string; total: string }[];
}

/** financialSummary de hoje (fuso SP): from = hoje, to = amanhã (exclusivo). */
export async function todaySummary(token: string): Promise<Summary> {
  const data = await gql<{ financialSummary: Summary }>(
    `query($f: String!, $t: String!) {
      financialSummary(from: $f, to: $t, granularity: "day") {
        billedTotal receivedTotal receivedByMethod { method total }
      }
    }`,
    { f: spDate(0), t: spDate(1) },
    { token },
  );
  return data.financialSummary;
}

export function methodTotal(summary: Summary, method: string): string {
  return summary.receivedByMethod.find((m) => m.method === method)?.total ?? '0.00';
}

/** Cliente exclusivo do spec: isola o saldo de crédito entre specs e repetições. */
export async function createClient(
  token: string,
  label: string,
): Promise<{ id: string; name: string }> {
  const name = `E2E Cliente ${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const data = await gql<{
    createClient: { client: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateClientInput!) {
      createClient(input: $input) { client { id } errors { code message } }
    }`,
    { input: { fullName: name, phone: '(11) 98888-7777' } },
    { token },
  );
  expectNoUserErrors(data.createClient, `createClient ${name}`);
  return { id: data.createClient.client!.id, name };
}
