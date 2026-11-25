import { adminPrisma } from './setup';
import { gqlAs } from './helpers/phase3-fixtures';
import {
  createPhase91World,
  destroyPhase91World,
  insertStudioBrideGroup,
  type Phase91World,
} from './helpers/phase91-fixtures';

const NEW_EMAIL = 'p91m-nova@teste.com';

const CREATE = `mutation($i: CreateMemberInput!) { createMember(input: $i) {
  member { id isProfessional isBridalAssistant }
  errors { code message field } } }`;
const UPDATE = `mutation($i: UpdateMemberInput!) { updateMember(input: $i) {
  member { id isProfessional isBridalAssistant }
  errors { code message field } } }`;
const DEACTIVATE = `mutation($id: UUID!) { deactivateMember(id: $id) {
  member { id status } errors { code message field } } }`;
const MEMBERS = `query { members { id isBridalAssistant } }`;

const ymd = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

describe('09.1 — profissional Assistente da Noiva', () => {
  let w: Phase91World;

  const cleanupNew = async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE user_id IN (SELECT id FROM users WHERE email = '${NEW_EMAIL}')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = '${NEW_EMAIL}')`,
    );
    await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email = '${NEW_EMAIL}'`);
  };

  beforeAll(async () => {
    await cleanupNew();
    w = await createPhase91World('p91m');
  });

  afterAll(async () => {
    await destroyPhase91World(w);
    await cleanupNew();
  });

  const baseInput = (extra: Record<string, unknown>) => ({
    displayName: 'p91m Nova',
    email: NEW_EMAIL,
    phone: '(11) 98765-4321',
    pixKey: '123.456.789-09',
    temporaryPassword: 'Prov1sorio-Senha',
    ...extra,
  });

  it('ADMIN cria profissional já marcada como assistente e o campo aparece em members', async () => {
    const res = await gqlAs(w, w.tokens.admin)(CREATE, {
      i: baseInput({
        roleName: 'PROFESSIONAL',
        isProfessional: true,
        isBridalAssistant: true,
        categoryIds: [w.categoryId],
      }),
    });
    const p = res.data!.createMember;
    expect(p.errors).toEqual([]);
    expect(p.member.isBridalAssistant).toBe(true);

    const list = await gqlAs(w, w.tokens.admin)(MEMBERS);
    const found = (list.data!.members as { id: string; isBridalAssistant: boolean }[]).find(
      (m) => m.id === p.member.id,
    );
    expect(found?.isBridalAssistant).toBe(true);
  });

  it('MANAGER desmarca e remarca a assistente (sem vínculo)', async () => {
    const run = gqlAs(w, w.tokens.manager);
    const off = await run(UPDATE, { i: { id: w.assistants.a, isBridalAssistant: false } });
    expect(off.data!.updateMember.errors).toEqual([]);
    expect(off.data!.updateMember.member.isBridalAssistant).toBe(false);
    const on = await run(UPDATE, { i: { id: w.assistants.a, isBridalAssistant: true } });
    expect(on.data!.updateMember.errors).toEqual([]);
    expect(on.data!.updateMember.member.isBridalAssistant).toBe(true);
  });

  it('não profissional não pode ser marcada na criação', async () => {
    const res = await gqlAs(w, w.tokens.admin)(CREATE, {
      i: baseInput({
        email: 'p91m-naoprof@teste.com',
        roleName: 'ATTENDANT',
        isProfessional: false,
        isBridalAssistant: true,
      }),
    });
    const p = res.data!.createMember;
    expect(p.member).toBeNull();
    expect(p.errors[0].code).toBe('BRIDAL_ASSISTANT_REQUIRES_PROFESSIONAL');
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email = 'p91m-naoprof@teste.com'`,
    );
  });

  it('deixar de ser profissional zera isBridalAssistant', async () => {
    const res = await gqlAs(w, w.tokens.admin)(UPDATE, {
      i: { id: w.assistants.a, roleName: 'ATTENDANT', isProfessional: false },
    });
    expect(res.data!.updateMember.errors).toEqual([]);
    expect(res.data!.updateMember.member.isProfessional).toBe(false);
    expect(res.data!.updateMember.member.isBridalAssistant).toBe(false);
  });

  it('assistente vinculada a grupo futuro não pode ser desativada nem desmarcada; grupo passado libera', async () => {
    const { groupId } = await insertStudioBrideGroup(w, { eventDate: ymd(10) });
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = '${w.assistants.b}'::uuid,
              assistant_daily_rate = 220, assistant_linked_at = now() WHERE id = '${groupId}'::uuid`,
    );
    const run = gqlAs(w, w.tokens.admin);

    const deact = await run(DEACTIVATE, { id: w.assistants.b });
    expect(deact.data!.deactivateMember.member).toBeNull();
    expect(deact.data!.deactivateMember.errors[0].code).toBe('MEMBER_IS_BRIDAL_ASSISTANT');

    const unmark = await run(UPDATE, { i: { id: w.assistants.b, isBridalAssistant: false } });
    expect(unmark.data!.updateMember.errors[0].code).toBe('MEMBER_IS_BRIDAL_ASSISTANT');

    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET event_date = '${ymd(-3)}'::date WHERE id = '${groupId}'::uuid`,
    );
    const ok = await run(DEACTIVATE, { id: w.assistants.b });
    expect(ok.data!.deactivateMember.errors).toEqual([]);
    expect(ok.data!.deactivateMember.member.status).toBe('inactive');
  });

  it('PROFESSIONAL não consegue editar a função (negado)', async () => {
    const res = await gqlAs(w, w.tokens.proA)(UPDATE, {
      i: { id: w.assistants.a, isBridalAssistant: true },
    });
    expect(res.errors?.length ?? 0).toBeGreaterThan(0);
    expect(JSON.stringify(res.errors)).toMatch(/FORBIDDEN|forbidden|permiss/i);
    expect(res.data?.updateMember ?? null).toBeNull();
  });
});
