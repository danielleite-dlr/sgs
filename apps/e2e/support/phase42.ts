import { apiLogin, type SeedState } from './seed-state';
import { expectNoUserErrors, gql } from './graphql';
import { createProfessional } from './phase3';

/** Dois serviços da categoria do seed (make e penteado) e um pacote que os contém. */
export async function createGlamPackage(
  seed: SeedState,
  token: string,
  opts: { name: string; price: string },
): Promise<{ id: string; name: string; makeServiceId: string; hairServiceId: string }> {
  const mkService = async (name: string): Promise<string> => {
    const data = await gql<{
      createService: { service: { id: string } | null; errors: never[] };
    }>(
      `mutation($input: CreateServiceInput!) {
        createService(input: $input) { service { id } errors { code message } }
      }`,
      {
        input: {
          name,
          categoryId: seed.phase3.categoryId,
          basePrice: '300.00',
          defaultDurationMinutes: 90,
        },
      },
      { token },
    );
    expectNoUserErrors(data.createService, `createService ${name}`);
    return data.createService.service!.id;
  };
  const makeServiceId = await mkService(`${opts.name} Make`);
  const hairServiceId = await mkService(`${opts.name} Penteado`);
  const data = await gql<{
    createPackage: { package: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreatePackageInput!) {
      createPackage(input: $input) { package { id } errors { code message } }
    }`,
    {
      input: {
        name: opts.name,
        price: opts.price,
        depositKind: 'percent',
        depositValue: '30',
        services: [
          { serviceId: makeServiceId, quantity: 1 },
          { serviceId: hairServiceId, quantity: 1 },
        ],
      },
    },
    { token },
  );
  expectNoUserErrors(data.createPackage, `createPackage ${opts.name}`);
  return { id: data.createPackage.package!.id, name: opts.name, makeServiceId, hairServiceId };
}

/** Regra do Glam da referência (saída = 0): make e penteado de 90 min, registro 90 min antes. */
export async function setGlamTimeline(
  token: string,
  packageId: string,
  makeServiceId: string,
  hairServiceId: string,
): Promise<void> {
  const steps = [
    { name: 'chegada - coffee', offsetMinutes: 450, isExtra: false },
    { name: 'massagem', offsetMinutes: 390, isExtra: false },
    { name: 'banheira', offsetMinutes: 330, isExtra: false },
    {
      name: 'make',
      offsetMinutes: 270,
      isExtra: false,
      kind: 'make',
      serviceId: makeServiceId,
      durationMinutes: 90,
    },
    {
      name: 'penteado',
      offsetMinutes: 180,
      isExtra: false,
      kind: 'hair',
      serviceId: hairServiceId,
      durationMinutes: 90,
    },
    { name: 'fotos', offsetMinutes: 90, isExtra: false, startsRegistry: true },
    { name: 'saída', offsetMinutes: 0, isExtra: false },
    { name: 'Chegada fotógrafos', offsetMinutes: 110, isExtra: true },
  ];
  const data = await gql<{
    setPackageTimeline: { steps: { id: string }[]; errors: never[] };
  }>(
    `mutation($input: SetPackageTimelineInput!) {
      setPackageTimeline(input: $input) { steps { id } errors { code message } }
    }`,
    { input: { packageId, steps } },
    { token },
  );
  expectNoUserErrors(data.setPackageTimeline, 'setPackageTimeline');
}

export interface GroupWithCompanion {
  groupId: string;
  groupName: string;
  brideName: string;
  brideClientId: string;
  companionName: string;
  companionClientId: string;
}

/** Grupo com noiva e 1 acompanhante, com pacote e "pronta até" (readyBy) às `readyBy` locais. */
export async function createGroupWithCompanion(
  seed: SeedState,
  token: string,
  opts: { packageId: string; eventDate: string; readyBy: string; unique: string },
): Promise<GroupWithCompanion> {
  const groupName = `Cronograma E2E ${opts.unique}`;
  const brideName = `Vitoria ${opts.unique}`;
  const companionName = `Acompanhante ${opts.unique}`;
  const data = await gql<{
    createBridalGroup: { group: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateBridalGroupInput!) {
      createBridalGroup(input: $input) { group { id } errors { code message } }
    }`,
    {
      input: {
        group: {
          name: groupName,
          eventDate: opts.eventDate,
          eventTime: '17:00',
          readyBy: `${opts.eventDate}T${opts.readyBy}:00-03:00`,
          packageId: opts.packageId,
        },
        bride: { newClient: { fullName: brideName, phone: '11987654321' } },
        companions: [{ newClient: { fullName: companionName, phone: '11987654322' } }],
      },
    },
    { token },
  );
  expectNoUserErrors(data.createBridalGroup, 'createBridalGroup');
  const groupId = data.createBridalGroup.group!.id;
  const members = await gql<{
    bridalGroup: { members: { clientId: string; clientName: string; role: string }[] };
  }>(
    `query($id: UUID!) { bridalGroup(id: $id) { members { clientId clientName role } } }`,
    { id: groupId },
    { token },
  );
  const bride = members.bridalGroup.members.find((m) => m.role === 'bride');
  const companion = members.bridalGroup.members.find((m) => m.role === 'companion');
  if (!bride || !companion) throw new Error('grupo sem noiva ou acompanhante');
  return {
    groupId,
    groupName,
    brideName,
    brideClientId: bride.clientId,
    companionName,
    companionClientId: companion.clientId,
  };
}

/**
 * Atendente para o spec: usa `seed.attendant` (criado pelo seed.setup.ts, papel ATTENDANT);
 * se ele não existir ou o login falhar, cria um membro ATTENDANT exclusivo.
 */
export async function ensureAttendant(
  seed: SeedState,
  ownerToken: string,
): Promise<{ email: string; password: string; name: string; token: string }> {
  if (seed.attendant) {
    try {
      const token = await apiLogin(seed.attendant.email, seed.attendant.password);
      return { ...seed.attendant, token };
    } catch {
      // cai para a criação abaixo
    }
  }
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-atendente-${unique}@example.com`;
  const name = `E2E Atendente ${unique}`;
  const created = await gql<{
    createMember: { member: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateMemberInput!) {
      createMember(input: $input) { member { id } errors { code message } }
    }`,
    {
      input: {
        displayName: name,
        email,
        phone: '(11) 91234-5698',
        roleName: 'ATTENDANT',
        isProfessional: false,
        temporaryPassword: 'Prov#Temp2026',
      },
    },
    { token: ownerToken },
  );
  expectNoUserErrors(created.createMember, `createMember ${name}`);
  const first = await apiLogin(email, 'Prov#Temp2026');
  const changed = await gql<{ changePassword: { success: boolean; errors: never[] } }>(
    `mutation($input: ChangePasswordInput!) {
      changePassword(input: $input) { success errors { code message } }
    }`,
    { input: { currentPassword: 'Prov#Temp2026', newPassword: seed.owner.password } },
    { token: first },
  );
  expectNoUserErrors(changed.changePassword, `changePassword ${name}`);
  const token = await apiLogin(email, seed.owner.password);
  return { email, password: seed.owner.password, name, token };
}

export { createProfessional };
