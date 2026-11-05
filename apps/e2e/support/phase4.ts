import type { Page } from '@playwright/test';
import { API_URL, expectNoUserErrors, gql } from './graphql';
import { spDate } from './phase3';
import type { SeedState } from './seed-state';

export { spDate };

/** Data local (YYYY-MM-DD) `n` dias a partir de hoje (fuso SP). */
export const todayPlusDays = (n: number): string => spDate(n);

/** Soma `days` dias a uma data YYYY-MM-DD (aritmética UTC, sem fuso). */
export function addDaysYmd(ymd: string, days: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** YYYY-MM-DD -> DD/MM/YYYY. */
export function ymdToBr(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/** Dia da semana (0 = domingo) de uma data YYYY-MM-DD. */
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

/**
 * Primeira quarta-feira a pelo menos `minDays` dias de hoje (dia útil: a agenda
 * dos profissionais criados no E2E atende, e a heurística não esbarra em folga).
 */
export function firstWednesdayFromNow(minDays: number): string {
  let n = minDays;
  while (weekdayOf(spDate(n)) !== 3) n += 1;
  return spDate(n);
}

/** Pacote de noiva com entrada percentual, usando o serviço do seed. */
export async function createBridalPackage(
  seed: SeedState,
  token: string,
  opts: { price: string; depositPercent: string; name?: string },
): Promise<{ id: string; name: string }> {
  const name = opts.name ?? `Pacote Noiva ${Date.now().toString(36)}`;
  const data = await gql<{
    createPackage: { package: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreatePackageInput!) {
      createPackage(input: $input) { package { id } errors { code message } }
    }`,
    {
      input: {
        name,
        price: opts.price,
        depositKind: 'percent',
        depositValue: opts.depositPercent,
        services: [{ serviceId: seed.phase3.serviceId, quantity: 1 }],
      },
    },
    { token },
  );
  expectNoUserErrors(data.createPackage, `createPackage ${name}`);
  return { id: data.createPackage.package!.id, name };
}

/** Lê a URL de aceite exibida no ContractLinkCard. */
export async function extractAcceptLink(page: Page): Promise<string> {
  const url = await page.getByTestId('contract-link-url').inputValue();
  if (!/\/aceite\//.test(url)) throw new Error(`Link de aceite inesperado: ${url}`);
  return url;
}

/** updateContract só com o prazo do restante (dias antes do evento). */
export async function setBalanceDueDaysBefore(
  token: string,
  contractId: string,
  days: number,
): Promise<void> {
  const data = await gql<{ updateContract: { errors: never[] } }>(
    `mutation($id: UUID!, $input: UpdateContractInput!) {
      updateContract(id: $id, input: $input) { contract { id } errors { code message } }
    }`,
    { id: contractId, input: { balanceDueDaysBefore: days } },
    { token },
  );
  expectNoUserErrors(data.updateContract, 'updateContract (prazo)');
}

/**
 * Depois de editar o contrato a versão nova exige novo aceite (status volta a
 * "aguardando aceite", que só gera o alerta de "não aceito"). Gera outro link
 * e aceita pela rota pública, como a noiva faria, para o contrato voltar a ativo.
 */
export async function reacceptContract(
  token: string,
  orgId: string,
  contractId: string,
  fullName: string,
  cpf: string,
): Promise<void> {
  const link = await gql<{
    generateContractLink: { url: string | null; errors: never[] };
  }>(
    `mutation($id: UUID!) { generateContractLink(id: $id) { url errors { code message } } }`,
    { id: contractId },
    { token },
  );
  expectNoUserErrors(link.generateContractLink, 'generateContractLink (reaceite)');
  const url = link.generateContractLink.url!;
  const secret = url.split('/').pop()!;
  const base = new URL(API_URL).origin;
  const current = await gql<{ contract: { currentTextSha256: string } }>(
    `query($id: UUID!) { contract(id: $id) { currentTextSha256 } }`,
    { id: contractId },
    { token },
  );
  const res = await fetch(`${base}/public/contracts/${orgId}/${secret}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName,
      cpf,
      accepted: true,
      textSha256: current.contract.currentTextSha256,
    }),
  });
  if (!res.ok) throw new Error(`Reaceite falhou (${res.status}): ${await res.text()}`);
}

export interface AlertsRun {
  ran: boolean;
  candidates: number;
  created: number;
  resolved: number;
  emailed: number;
}

/** Dispara os alertas de contrato agora (o agendador fica desligado no E2E). */
export async function runContractAlertsNow(token: string): Promise<AlertsRun> {
  const data = await gql<{ runContractAlertsNow: AlertsRun }>(
    `mutation { runContractAlertsNow { ran candidates created resolved emailed } }`,
    {},
    { token },
  );
  return data.runContractAlertsNow;
}

/** contractBilledTotal do dia (fuso SP). */
export async function contractBilledToday(token: string): Promise<string> {
  const data = await gql<{ financialSummary: { contractBilledTotal: string } }>(
    `query($f: String!, $t: String!) {
      financialSummary(from: $f, to: $t, granularity: "day") { contractBilledTotal }
    }`,
    { f: spDate(0), t: spDate(1) },
    { token },
  );
  return data.financialSummary.contractBilledTotal;
}

export interface GroupAppointment {
  clientName: string;
  covered: boolean;
  status: string;
}

export async function groupAppointments(
  token: string,
  groupId: string,
): Promise<GroupAppointment[]> {
  const data = await gql<{ bridalGroup: { appointments: GroupAppointment[] } }>(
    `query($id: UUID!) { bridalGroup(id: $id) { appointments { clientName covered status } } }`,
    { id: groupId },
    { token },
  );
  return data.bridalGroup.appointments;
}

/**
 * Completa os dados exigidos para gerar o link do contrato (gate D-09, fase 04.1):
 * CPF/endereço/celulares da noiva, horário do evento e dados do studio. Os demais
 * campos do grupo são relidos e reenviados para o update não zerá-los.
 */
export async function completeContractData(
  token: string,
  opts: { groupId: string; brideClientId?: string },
): Promise<void> {
  const g = await gql<{
    bridalGroup: {
      name: string;
      eventDate: string;
      readyBy: string | null;
      locationKind: string;
      locationAddress: string | null;
      locationName: string | null;
      travelMinutesBefore: number;
      travelMinutesAfter: number;
      notes: string | null;
      members: { clientId: string; role: string }[];
    };
  }>(
    `query($id: UUID!) {
      bridalGroup(id: $id) {
        name eventDate readyBy locationKind locationAddress locationName
        travelMinutesBefore travelMinutesAfter notes
        members { clientId role }
      }
    }`,
    { id: opts.groupId },
    { token },
  );
  const group = g.bridalGroup;
  const brideClientId =
    opts.brideClientId ?? group.members.find((m) => m.role === 'bride')!.clientId;

  const client = await gql<{ updateClient: { errors: never[] } }>(
    `mutation($input: UpdateClientInput!) {
      updateClient(input: $input) { errors { code message } }
    }`,
    {
      input: {
        id: brideClientId,
        cpf: '52998224725',
        address: 'Rua das Flores, 10 - Osasco/SP',
        phone: '11987654321',
        phone2: '(11) 91111-2222',
      },
    },
    { token },
  );
  expectNoUserErrors(client.updateClient, 'updateClient da noiva');

  const upd = await gql<{ updateBridalGroup: { errors: never[] } }>(
    `mutation($id: UUID!, $input: BridalGroupFieldsInput!) {
      updateBridalGroup(id: $id, input: $input) { errors { code message } }
    }`,
    {
      id: opts.groupId,
      input: {
        name: group.name,
        eventDate: group.eventDate,
        readyBy: group.readyBy,
        locationKind: group.locationKind,
        locationAddress: group.locationAddress,
        locationName: group.locationName,
        travelMinutesBefore: group.travelMinutesBefore,
        travelMinutesAfter: group.travelMinutesAfter,
        notes: group.notes,
        eventTime: '16:00',
      },
    },
    { token },
  );
  expectNoUserErrors(upd.updateBridalGroup, 'updateBridalGroup (horário do evento)');

  const settings = await gql<{ updateContractSettings: { errors: never[] } }>(
    `mutation($i: UpdateContractSettingsInput!) {
      updateContractSettings(input: $i) { errors { code message } }
    }`,
    {
      i: {
        studio: {
          name: 'Studio E2E',
          cnpj: '48562103000171',
          address: 'Rua E2E, 1',
          representative: 'Dona E2E',
          representativeRg: '11.111.111-1',
          forumCity: 'Osasco',
          forumUf: 'SP',
        },
      },
    },
    { token },
  );
  expectNoUserErrors(settings.updateContractSettings, 'updateContractSettings (studio)');
}
