import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test as setup } from '@playwright/test';
import { BACKEND_DIR, loadE2eEnv } from '../scripts/e2e-env.mjs';
import { expectNoUserErrors, gql } from '../support/graphql';
import { writeSeedState, type SeedUser } from '../support/seed-state';

const PLATFORM_EMAIL = 'e2e-platform@example.com';
const PLATFORM_PASSWORD = 'E2ePlatform#2026';
const KNOWN_PASSWORD = 'E2eSenha#2026';

interface LoginResult {
  accessToken: string;
  organizationId?: string;
  mustChangePassword: boolean;
}

async function login(email: string, password: string): Promise<LoginResult> {
  const data = await gql<{
    login: {
      accessToken: string | null;
      session: {
        mustChangePassword: boolean;
        memberships: { organizationId: string }[];
      } | null;
      errors: { code: string; message: string }[];
    };
  }>(
    `mutation($input: LoginInput!) {
      login(input: $input) {
        accessToken
        session { mustChangePassword memberships { organizationId } }
        errors { code message }
      }
    }`,
    { input: { email, password } },
  );
  const { login: payload } = data;
  expectNoUserErrors(payload, `login ${email}`);
  if (!payload.accessToken || !payload.session) {
    throw new Error(`login ${email} sem sessão`);
  }
  return {
    accessToken: payload.accessToken,
    organizationId: payload.session.memberships[0]?.organizationId,
    mustChangePassword: payload.session.mustChangePassword,
  };
}

async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
  who: string,
): Promise<void> {
  const data = await gql<{ changePassword: { success: boolean; errors: never[] } }>(
    `mutation($input: ChangePasswordInput!) {
      changePassword(input: $input) { success errors { code message } }
    }`,
    { input: { currentPassword, newPassword } },
    { token },
  );
  expectNoUserErrors(data.changePassword, `changePassword ${who}`);
}

setup('seed', async () => {
  setup.setTimeout(120_000);
  // O banco local é persistente: sufixo único por execução em tudo.
  const suffix = Date.now().toString(36);

  // (a) bootstrap do platform admin pelo script oficial (idempotente)
  execFileSync(
    process.execPath,
    [
      join(BACKEND_DIR, 'dist', 'scripts', 'create-platform-admin.js'),
      PLATFORM_EMAIL,
      PLATFORM_PASSWORD,
      'E2E Platform',
    ],
    { env: loadE2eEnv(), stdio: 'inherit' },
  );

  // (b) org + owner pela API pública
  const platform = await login(PLATFORM_EMAIL, PLATFORM_PASSWORD);
  const ownerEmail = `e2e-owner-${suffix}@example.com`;
  const created = await gql<{
    adminCreateClient: {
      temporaryPassword: string | null;
      errors: { code: string; message: string }[];
    };
  }>(
    `mutation($input: AdminCreateClientInput!) {
      adminCreateClient(input: $input) { temporaryPassword errors { code message } }
    }`,
    {
      input: {
        salonName: `E2E Salao ${suffix}`,
        ownerName: `E2E Dono ${suffix}`,
        ownerEmail,
      },
    },
    { token: platform.accessToken },
  );
  expectNoUserErrors(created.adminCreateClient, 'adminCreateClient');
  const tempPassword = created.adminCreateClient.temporaryPassword;
  if (!tempPassword) throw new Error('adminCreateClient sem senha temporária');

  const ownerFirst = await login(ownerEmail, tempPassword);
  await changePassword(ownerFirst.accessToken, tempPassword, KNOWN_PASSWORD, 'owner');
  const owner = await login(ownerEmail, KNOWN_PASSWORD);
  const orgId = owner.organizationId;
  if (!orgId) throw new Error('owner sem organização');
  const ctx = { token: owner.accessToken, orgId };

  // (c) categoria (profissional exige ao menos uma) e membros
  const category = await gql<{
    createCategory: { category: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateCategoryInput!) {
      createCategory(input: $input) { category { id } errors { code message } }
    }`,
    { input: { name: `E2E Cabelo ${suffix}` } },
    ctx,
  );
  expectNoUserErrors(category.createCategory, 'createCategory');
  const categoryId = category.createCategory.category!.id;

  async function createMember(
    displayName: string,
    email: string,
    roleName: string,
    phone: string,
    pixKey: string,
  ): Promise<SeedUser> {
    const data = await gql<{
      createMember: {
        member: { id: string } | null;
        errors: { code: string; message: string }[];
      };
    }>(
      `mutation($input: CreateMemberInput!) {
        createMember(input: $input) { member { id } errors { code message } }
      }`,
      {
        input: {
          displayName,
          email,
          phone,
          pixKey,
          roleName,
          isProfessional: roleName === 'PROFESSIONAL',
          categoryIds: roleName === 'PROFESSIONAL' ? [categoryId] : [],
          temporaryPassword: 'Prov#Temp2026',
        },
      },
      ctx,
    );
    expectNoUserErrors(data.createMember, `createMember ${displayName}`);
    return {
      email,
      password: KNOWN_PASSWORD,
      name: displayName,
      memberId: data.createMember.member?.id,
    };
  }

  const manager = await createMember(
    `E2E Gerente ${suffix}`,
    `e2e-gerente-${suffix}@example.com`,
    'MANAGER',
    '(11) 91234-5601',
    `e2e-gerente-${suffix}@example.com`,
  );
  const attendant = await createMember(
    `E2E Atendente ${suffix}`,
    `e2e-atendente-${suffix}@example.com`,
    'ATTENDANT',
    '(11) 91234-5602',
    `e2e-atendente-${suffix}@example.com`,
  );
  const proBlocked = await createMember(
    `E2E Pro Bloqueado ${suffix}`,
    `e2e-bloqueado-${suffix}@example.com`,
    'PROFESSIONAL',
    '(11) 91234-5603',
    `e2e-bloqueado-${suffix}@example.com`,
  );
  const proEditable = await createMember(
    `E2E Pro Editavel ${suffix}`,
    `e2e-editavel-${suffix}@example.com`,
    'PROFESSIONAL',
    '(11) 91234-5604',
    `e2e-editavel-${suffix}@example.com`,
  );

  // A senha provisória força /trocar-senha: troca para a UI cair direto na home.
  for (const user of [manager, attendant]) {
    const first = await login(user.email, 'Prov#Temp2026');
    await changePassword(first.accessToken, 'Prov#Temp2026', KNOWN_PASSWORD, user.name);
  }

  // (d) serviço, cliente e agendamento futuro do "Pro Bloqueado"
  const serviceName = `E2E Corte ${suffix}`;
  const service = await gql<{
    createService: { service: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateServiceInput!) {
      createService(input: $input) { service { id } errors { code message } }
    }`,
    {
      input: {
        name: serviceName,
        categoryId,
        basePrice: '80.00',
        defaultDurationMinutes: 60,
      },
    },
    ctx,
  );
  expectNoUserErrors(service.createService, 'createService');
  const serviceId = service.createService.service!.id;

  const clientName = `E2E Cliente ${suffix}`;
  const client = await gql<{
    createClient: { client: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateClientInput!) {
      createClient(input: $input) { client { id } errors { code message } }
    }`,
    { input: { fullName: clientName, phone: '(11) 98888-7777' } },
    ctx,
  );
  expectNoUserErrors(client.createClient, 'createClient');
  const clientId = client.createClient.client!.id;

  // Amanhã 10:00-11:00 em America/Sao_Paulo (UTC-3, sem horário de verão).
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(tomorrow);
  const startsAt = `${ymd}T10:00:00-03:00`;
  const endsAt = `${ymd}T11:00:00-03:00`;
  const appointment = await gql<{
    createAppointment: { appointment: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateAppointmentInput!) {
      createAppointment(input: $input) { appointment { id } errors { code message } }
    }`,
    {
      input: {
        professionalId: proBlocked.memberId,
        clientId,
        serviceId,
        startsAt,
        endsAt,
      },
    },
    ctx,
  );
  expectNoUserErrors(appointment.createAppointment, 'createAppointment');

  writeSeedState({
    suffix,
    orgId,
    owner: {
      email: ownerEmail,
      password: KNOWN_PASSWORD,
      name: `E2E Dono ${suffix}`,
    },
    manager,
    attendant,
    proBlocked,
    proEditable,
    appointment: {
      id: appointment.createAppointment.appointment!.id,
      clientName,
      serviceName,
      startsAt,
      endsAt,
    },
  });
});
