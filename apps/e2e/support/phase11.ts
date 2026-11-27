import { expectNoUserErrors, gql } from './graphql';
import type { SeedState } from './seed-state';

/** Marca/desmarca "fixa" e "atende noiva" de um membro (fase 11). */
export async function markPriorityFlags(
  token: string,
  memberId: string,
  flags: { isFixed?: boolean; servesBridal?: boolean },
): Promise<void> {
  const data = await gql<{ updateMember: { errors: never[] } }>(
    `mutation($input: UpdateMemberInput!) {
      updateMember(input: $input) { errors { code message } }
    }`,
    { input: { id: memberId, ...flags } },
    { token },
  );
  expectNoUserErrors(data.updateMember, 'updateMember (fase 11)');
}

/** G-01: cria membro com papel Assistente pela API (sem e-mail/senha). */
export async function createAssistantMember(
  token: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const digits = String(Math.floor(Math.random() * 90_000_000) + 10_000_000);
  const data = await gql<{
    createMember: { member: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateMemberInput!) {
      createMember(input: $input) { member { id } errors { code message } }
    }`,
    {
      input: {
        displayName: name,
        phone: `119${digits}`,
        pixKey: `e2e-assist-${unique}@example.com`,
        roleName: 'ASSISTANT',
      },
    },
    { token },
  );
  expectNoUserErrors(data.createMember, `createMember Assistente ${name}`);
  return { id: data.createMember.member!.id, name };
}

/** G-01: grupo de debutante no estúdio com o pacote dado (igual ao de noiva, com eventKind 'debutante'). */
export async function createStudioDebutanteGroup(
  seed: SeedState,
  token: string,
  opts: { packageId: string; eventDate: string; unique: string },
): Promise<{ groupId: string; debutanteName: string }> {
  void seed;
  const debutanteName = `E2E Debutante ${opts.unique}`;
  const data = await gql<{
    createBridalGroup: { group: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateBridalGroupInput!) {
      createBridalGroup(input: $input) {
        group { id }
        errors { code message }
      }
    }`,
    {
      input: {
        group: {
          name: `Debutante ${debutanteName}`,
          eventDate: opts.eventDate,
          eventKind: 'debutante',
          newResponsible: { fullName: `E2E Responsável ${opts.unique}`, phone: '11987650001' },
          locationKind: 'studio',
          eventTime: '16:00',
          packageId: opts.packageId,
        },
        bride: { newClient: { fullName: debutanteName, phone: '11987650000' } },
      },
    },
    { token },
  );
  expectNoUserErrors(data.createBridalGroup, 'createBridalGroup (debutante)');
  return { groupId: data.createBridalGroup.group!.id, debutanteName };
}
