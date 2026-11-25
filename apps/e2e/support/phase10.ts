import { gql, expectNoUserErrors } from './graphql';
import { apiLogin, type SeedState } from './seed-state';

export interface CreatedMember {
  id: string;
  name: string;
  email: string;
  password: string;
}

/**
 * Cria um membro exclusivo do spec (via API) com o papel pedido e a senha já trocada.
 * O seed é compartilhado entre specs; cada spec da fase 10 usa o seu próprio membro.
 */
export async function createMemberWithRole(
  seed: SeedState,
  ownerToken: string,
  role: 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL',
  label: string,
): Promise<CreatedMember> {
  const unique = `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const email = `e2e-${unique}@example.com`;
  const name = `E2E ${label} ${unique.slice(-6)}`;
  const isProfessional = role === 'PROFESSIONAL';
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
        roleName: role,
        isProfessional,
        ...(isProfessional ? { categoryIds: [seed.phase3.categoryId] } : {}),
        temporaryPassword: 'Prov#Temp2026',
      },
    },
    { token: ownerToken },
  );
  expectNoUserErrors(data.createMember, `createMember ${name}`);
  const first = await apiLogin(email, 'Prov#Temp2026');
  const changed = await gql<{ changePassword: { success: boolean; errors: never[] } }>(
    `mutation($input: ChangePasswordInput!) {
      changePassword(input: $input) { success errors { code message } }
    }`,
    { input: { currentPassword: 'Prov#Temp2026', newPassword: seed.owner.password } },
    { token: first },
  );
  expectNoUserErrors(changed.changePassword, `changePassword ${name}`);
  return { id: data.createMember.member!.id, name, email, password: seed.owner.password };
}

export async function setMemberAccessViaApi(
  token: string,
  memberId: string,
  changes: Array<{ itemId: string; enabled: boolean }>,
): Promise<void> {
  const data = await gql<{ setMemberAccess: { errors: never[] } }>(
    `mutation($input: SetMemberAccessInput!) {
      setMemberAccess(input: $input) { errors { code message } }
    }`,
    { input: { memberId, changes } },
    { token },
  );
  expectNoUserErrors(data.setMemberAccess, 'setMemberAccess');
}

export async function resetMemberAccessViaApi(token: string, memberId: string): Promise<void> {
  const data = await gql<{ resetMemberAccess: { errors: never[] } }>(
    `mutation($memberId: UUID!) {
      resetMemberAccess(memberId: $memberId) { errors { code message } }
    }`,
    { memberId },
    { token },
  );
  expectNoUserErrors(data.resetMemberAccess, 'resetMemberAccess');
}
