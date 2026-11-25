import { expectNoUserErrors, gql } from './graphql';
import type { SeedState } from './seed-state';

/** Marca/desmarca a função Assistente da Noiva de um membro (09.1). */
export async function markBridalAssistant(
  token: string,
  memberId: string,
  on = true,
): Promise<void> {
  const data = await gql<{ updateMember: { errors: never[] } }>(
    `mutation($input: UpdateMemberInput!) {
      updateMember(input: $input) { errors { code message } }
    }`,
    { input: { id: memberId, isBridalAssistant: on } },
    { token },
  );
  expectNoUserErrors(data.updateMember, 'updateMember (isBridalAssistant)');
}

/** Marca/desmarca "Inclui assistente da noiva" no pacote. */
export async function setPackageIncludesAssistant(
  token: string,
  packageId: string,
  on = true,
): Promise<void> {
  const data = await gql<{ updatePackage: { errors: never[] } }>(
    `mutation($input: UpdatePackageInput!) {
      updatePackage(input: $input) { package { id } errors { code message } }
    }`,
    { input: { id: packageId, includesBridalAssistant: on } },
    { token },
  );
  expectNoUserErrors(data.updatePackage, 'updatePackage (includesBridalAssistant)');
}

/** Grupo de noiva no estúdio com o pacote (os serviços do pacote entram na noiva). */
export async function createStudioBrideGroup(
  seed: SeedState,
  token: string,
  opts: { packageId: string; eventDate: string; brideName: string },
): Promise<{ groupId: string; brideClientId: string }> {
  void seed;
  const data = await gql<{
    createBridalGroup: {
      group: { id: string; members: { clientId: string; role: string }[] } | null;
      errors: never[];
    };
  }>(
    `mutation($input: CreateBridalGroupInput!) {
      createBridalGroup(input: $input) {
        group { id members { clientId role } }
        errors { code message }
      }
    }`,
    {
      input: {
        group: {
          name: `Casamento ${opts.brideName}`,
          eventDate: opts.eventDate,
          locationKind: 'studio',
          eventTime: '16:00',
          packageId: opts.packageId,
        },
        bride: {
          newClient: { fullName: opts.brideName, phone: '11987654321' },
        },
      },
    },
    { token },
  );
  expectNoUserErrors(data.createBridalGroup, 'createBridalGroup');
  const group = data.createBridalGroup.group!;
  const bride = group.members.find((m) => m.role === 'bride')!;
  return { groupId: group.id, brideClientId: bride.clientId };
}

/** Agenda todos os serviços da noiva com a profissional, em sequência a partir de startsAtIso. */
export async function scheduleBrideEvent(
  token: string,
  groupId: string,
  professionalId: string,
  serviceId: string,
  startsAtIso: string,
): Promise<void> {
  const g = await gql<{
    bridalGroup: {
      members: {
        id: string;
        role: string;
        services: { serviceId: string; durationMinutes: number; purpose: string }[];
      }[];
    };
  }>(
    `query($id: UUID!) {
      bridalGroup(id: $id) {
        members { id role services { serviceId durationMinutes purpose } }
      }
    }`,
    { id: groupId },
    { token },
  );
  const bride = g.bridalGroup.members.find((m) => m.role === 'bride')!;
  let cursor = Date.parse(startsAtIso);
  const items = bride.services
    .filter((s) => s.purpose !== 'trial')
    .map((s) => {
      const start = new Date(cursor);
      cursor += s.durationMinutes * 60_000;
      return {
        groupMemberId: bride.id,
        serviceId: s.serviceId || serviceId,
        professionalId,
        startsAt: start.toISOString(),
        endsAt: new Date(cursor).toISOString(),
      };
    });
  if (items.length === 0) throw new Error('A noiva não tem serviços de evento para agendar');
  const res = await gql<{ scheduleBridalEvent: { errors: never[] } }>(
    `mutation($input: ScheduleBridalEventInput!) {
      scheduleBridalEvent(input: $input) { appointmentIds errors { code message } }
    }`,
    { input: { groupId, items } },
    { token },
  );
  expectNoUserErrors(res.scheduleBridalEvent, 'scheduleBridalEvent');
}

/** Lança pagamento integral na comanda do evento da noiva e fecha. Devolve a comanda e o total. */
export async function closeBrideEventComanda(
  token: string,
  groupId: string,
): Promise<string> {
  const g = await gql<{
    bridalGroup: { appointments: { comandaId: string | null; status: string }[] };
  }>(
    `query($id: UUID!) { bridalGroup(id: $id) { appointments { comandaId status } } }`,
    { id: groupId },
    { token },
  );
  const comandaId = g.bridalGroup.appointments.find((a) => a.comandaId)?.comandaId;
  if (!comandaId) throw new Error('Grupo sem comanda do evento');
  const c = await gql<{ comanda: { owed: string } }>(
    `query($id: UUID!) { comanda(id: $id) { owed } }`,
    { id: comandaId },
    { token },
  );
  const pay = await gql<{ addComandaPayment: { errors: never[] } }>(
    `mutation($input: AddComandaPaymentInput!) {
      addComandaPayment(input: $input) { errors { code message } }
    }`,
    { input: { comandaId, method: 'pix', amount: c.comanda.owed } },
    { token },
  );
  expectNoUserErrors(pay.addComandaPayment, 'addComandaPayment');
  const closed = await gql<{ closeComanda: { errors: never[] } }>(
    `mutation($id: UUID!) { closeComanda(id: $id) { errors { code message } } }`,
    { id: comandaId },
    { token },
  );
  expectNoUserErrors(closed.closeComanda, 'closeComanda');
  return comandaId;
}

/** Total (string decimal) da comanda. */
export async function comandaTotal(token: string, comandaId: string): Promise<string> {
  const c = await gql<{ comanda: { total: string } }>(
    `query($id: UUID!) { comanda(id: $id) { total } }`,
    { id: comandaId },
    { token },
  );
  return c.comanda.total;
}
