import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';

const COUNT = `query { unreadNotificationCount }`;
const MARK = `mutation($i: MarkReadInput!) { markNotificationRead(input: $i) { id readAt } }`;
const MARK_ALL = `mutation { markAllNotificationsRead }`;

describe('Phase 4 - painel de notificações', () => {
  let w: Phase3World;
  let managerNotifId: string;

  beforeAll(async () => {
    w = await createPhase3World('p4notif');
    const ins = async (memberId: string | null, kind: string) => {
      const rows = await adminPrisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO notifications (organization_id, member_id, kind, payload)
         VALUES ('${w.orgId}'::uuid, ${memberId ? `'${memberId}'::uuid` : 'NULL'}, '${kind}', '{"title":"t","message":"m"}'::jsonb)
         RETURNING id`,
      );
      return rows[0].id;
    };
    await ins(w.members.admin, 'contract_balance_overdue');
    await ins(w.members.admin, 'contract_deposit_unpaid');
    await ins(null, 'stock_low');
    managerNotifId = await ins(w.members.manager, 'contract_not_accepted');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });

  it('conta, protege destinatário e marca todas como lidas', async () => {
    const adm = gqlAs(w, w.tokens.admin);
    const mgr = gqlAs(w, w.tokens.manager);

    expect((await adm(COUNT)).data.unreadNotificationCount).toBe(3);

    // admin não pode marcar a notificação do gerente
    const denied = await adm(MARK, { i: { id: managerNotifId } });
    expect(denied.errors?.length).toBeGreaterThan(0);

    const all = await adm(MARK_ALL);
    expect(all.data.markAllNotificationsRead).toBe(3);
    expect((await adm(COUNT)).data.unreadNotificationCount).toBe(0);

    // a do gerente continua não lida (a org-wide foi lida para todos)
    expect((await mgr(COUNT)).data.unreadNotificationCount).toBe(1);
  });

  it('gerente não consegue marcar notificação de outro membro', async () => {
    const mgr = gqlAs(w, w.tokens.manager);
    const adminNotif = await adminPrisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM notifications WHERE organization_id = '${w.orgId}'::uuid AND member_id = '${w.members.admin}'::uuid LIMIT 1`,
    );
    const r = await mgr(MARK, { i: { id: adminNotif[0].id } });
    expect(r.errors?.length).toBeGreaterThan(0);
  });
});
