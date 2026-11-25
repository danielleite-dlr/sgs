import { adminPrisma } from './setup';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { insertBridalGroupRow, insertContractRow } from './helpers/phase4-fixtures';
import {
  clearOverrides,
  createPhase10World,
  destroyPhase10World,
  gqlAs,
  setOverrideRow,
  type Phase10World,
} from './helpers/phase10-fixtures';
import { ContractAlertsService } from '../../src/contracts/alerts/contract-alerts.service';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PushService } from '../../src/push/push.service';
import type { PushProvider } from '../../src/push/push.types';

const NOW = new Date('2030-06-10T15:00:00.000Z');
const NOTIFS = `query { notifications(unreadOnly: true) { id kind } }`;
const COUNT = `query { unreadNotificationCount }`;
const MARK_ALL = `mutation { markAllNotificationsRead }`;

describe('10 — avisos e sino respeitam o acesso', () => {
  let w: Phase10World;
  const orgFilter = () => `SELECT id FROM organizations WHERE legal_name LIKE '${w.prefix}-%'`;

  beforeAll(async () => {
    w = await createPhase10World('p10notif');
  });
  afterAll(async () => {
    await cleanRows();
    await destroyPhase10World(w);
  });

  async function cleanRows() {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM notifications WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM device_tokens WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM commercial_reminders WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid AND bridal_group_id IS NOT NULL`,
    );
    await deletePhase4Rows(orgFilter());
  }

  afterEach(async () => {
    await clearOverrides(w);
    await cleanRows();
  });

  const kindsOf = async (token: string) => {
    const res = await gqlAs(w, token)(NOTIFS);
    expect(res.errors).toBeUndefined();
    return res.data.notifications.map((n: { kind: string }) => n.kind);
  };
  const countOf = async (token: string) => {
    const res = await gqlAs(w, token)(COUNT);
    expect(res.errors).toBeUndefined();
    return res.data.unreadNotificationCount as number;
  };

  it('stock_low some da lista, do contador e do "marcar todas" de quem perdeu produtos-todos', async () => {
    const n = await adminPrisma.notification.create({
      data: {
        organizationId: w.orgId,
        memberId: null,
        kind: 'stock_low',
        payload: { productId: w.productId, productName: 'x', currentStock: 1, minStockLevel: 2 },
      },
    });
    await setOverrideRow(w, w.members.manager, 'produtos-todos', false);

    expect(await kindsOf(w.tokens.manager)).not.toContain('stock_low');
    expect(await countOf(w.tokens.manager)).toBe(0);
    expect(await kindsOf(w.tokens.admin)).toContain('stock_low');
    expect(await countOf(w.tokens.admin)).toBe(1);

    const marked = await gqlAs(w, w.tokens.manager)(MARK_ALL);
    expect(marked.errors).toBeUndefined();
    const row = await adminPrisma.notification.findUniqueOrThrow({ where: { id: n.id } });
    expect(row.readAt).toBeNull();
  });

  it('alerta de contrato já existente some do gerente com Contratos desligado', async () => {
    await adminPrisma.notification.create({
      data: {
        organizationId: w.orgId,
        memberId: w.members.manager,
        kind: 'contract_balance_overdue',
        payload: { dedupeKey: 'x' },
      },
    });
    expect(await kindsOf(w.tokens.manager)).toContain('contract_balance_overdue');

    await setOverrideRow(w, w.members.manager, 'contratos', false);
    expect(await kindsOf(w.tokens.manager)).not.toContain('contract_balance_overdue');
    expect(await countOf(w.tokens.manager)).toBe(0);
  });

  it('o job de alertas não cria aviso para gerente com Contratos desligado; admin recebe', async () => {
    await setOverrideRow(w, w.members.manager, 'contratos', false);
    const g = await insertBridalGroupRow(w, { eventDate: '2030-08-01' });
    const c = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '8000.00',
      depositAmount: '2400.00',
      status: 'active',
      balanceDueDate: '2030-06-13',
    });
    await adminPrisma.contract.update({
      where: { id: c.contractId },
      data: {
        acceptedAt: new Date('2030-05-02T12:00:00.000Z'),
        createdAt: new Date('2030-05-01T12:00:00.000Z'),
      },
    });
    await adminPrisma.contractPayment.create({
      data: {
        organizationId: w.orgId,
        contractId: c.contractId,
        kind: 'payment',
        method: 'pix',
        amount: '6400.00',
      },
    });

    await w.app.get(ContractAlertsService).runForOrg(w.orgId, NOW);
    const rows = await adminPrisma.notification.findMany({
      where: { organizationId: w.orgId, kind: { startsWith: 'contract_' } },
    });
    const owners = rows.map((r) => r.memberId);
    expect(owners).toContain(w.members.admin);
    expect(owners).not.toContain(w.members.manager);
  });

  describe('push do lembrete do Comercial', () => {
    const sent: string[] = [];
    const provider: PushProvider = {
      enabled: true,
      send: jest.fn(async (token: string) => {
        sent.push(token);
        return { status: 'sent' as const };
      }),
    };

    async function addToken(memberId: string, token: string) {
      await adminPrisma.deviceToken.create({
        data: { organizationId: w.orgId, memberId, provider: 'fcm', platform: 'android', token },
      });
    }
    async function addReminder(createdBy: string) {
      return adminPrisma.commercialReminder.create({
        data: {
          organizationId: w.orgId,
          title: 'Ligar',
          dueAt: new Date(),
          createdBy,
        },
      });
    }
    const service = () => new PushService(w.app.get(TenantContextService), provider);

    beforeEach(() => {
      sent.length = 0;
    });

    it('gerente com comercial-lembretes desligado não recebe; o dono recebe', async () => {
      await addToken(w.members.attendant, 'tok-att');
      await addToken(w.members.manager, 'tok-ger');
      await addToken(w.members.admin, 'tok-adm');
      await setOverrideRow(w, w.members.manager, 'comercial-lembretes', false);
      const r = await addReminder(w.members.attendant);

      await service().dispatch({ kind: 'commercial.reminder', orgId: w.orgId, reminderId: r.id });
      expect(sent.sort()).toEqual(['tok-adm', 'tok-att']);
    });

    it('dono Profissional que ganhou comercial-lembretes passa a receber', async () => {
      await addToken(w.members.proA, 'tok-pro');
      const r = await addReminder(w.members.proA);

      await service().dispatch({ kind: 'commercial.reminder', orgId: w.orgId, reminderId: r.id });
      expect(sent).not.toContain('tok-pro');

      await setOverrideRow(w, w.members.proA, 'comercial-lembretes', true);
      sent.length = 0;
      await service().dispatch({ kind: 'commercial.reminder', orgId: w.orgId, reminderId: r.id });
      expect(sent).toContain('tok-pro');
    });
  });
});
