import { expectNoUserErrors, gql } from './graphql';

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
