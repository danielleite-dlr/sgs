import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertContractRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const OVERVIEW = `query($id: UUID!) {
  clientOverview(clientId: $id) {
    bridalGroups { id name eventKind role eventDate trialDates status }
    contracts { id code status totalAmount paid balance nextDueDate nextDueAmount }
    upcomingAppointments { id kind serviceName professionalName comandaId bridalGroupId }
    stats { completedCount totalSpent creditBalance lastVisitAt }
  }
}`;
const HISTORY = `query($id: UUID!, $f: ClientHistoryFilters) {
  clientHistory(clientId: $id, filters: $f) {
    id kind description amount professionalName entityType entityId occurredAt
  }
}`;

describe('Quick c360 - ficha da cliente (clientOverview / clientHistory)', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'qc360-%'`;
  let seq = 0;

  beforeAll(async () => {
    w = await createPhase4World('qc360');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM comanda_items WHERE organization_id IN (${orgFilter})`,
    );
    await adminPrisma.$executeRawUnsafe(
      `UPDATE appointments SET comanda_id = NULL WHERE organization_id IN (${orgFilter})`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM comandas WHERE organization_id IN (${orgFilter})`,
    );
    await deletePhase4Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id IN (${orgFilter})`,
    );
  });

  const adm = () => gqlAs(w, w.tokens.admin);

  function mkAppt(clientId: string, startOffsetMs: number, extra: Record<string, unknown> = {}) {
    const start = Date.now() + startOffsetMs + ++seq * 3 * HOUR;
    return adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId,
        serviceId: w.serviceId,
        startsAt: new Date(start),
        endsAt: new Date(start + HOUR),
        status: 'scheduled',
        ...extra,
      } as never,
    });
  }

  async function bride() {
    const eventDate = new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10);
    const g = await insertBridalGroupRow(w, { eventDate, companions: 1 });
    const c = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '8000.00',
      depositAmount: '2400.00',
      status: 'active',
      installments: [{ seq: 1, amount: '2400.00', dueDate: '2030-01-01' }],
    });
    await adminPrisma.contractPayment.create({
      data: {
        organizationId: w.orgId,
        contractId: c.contractId,
        kind: 'payment',
        method: 'pix',
        amount: '1000.00',
      },
    });
    const trial = await mkAppt(g.brideClientId, DAY, {
      bridalGroupId: g.groupId,
      contractId: c.contractId,
      purpose: 'trial',
    });
    return { ...g, ...c, eventDate, trial };
  }

  it('noiva: grupo, teste, evento e contrato com saldo', async () => {
    const b = await bride();
    const r = await adm()(OVERVIEW, { id: b.brideClientId });
    expect(r.errors).toBeUndefined();
    const o = r.data.clientOverview;
    expect(o.bridalGroups).toHaveLength(1);
    expect(o.bridalGroups[0]).toMatchObject({
      id: b.groupId,
      role: 'bride',
      eventKind: 'noiva',
      eventDate: b.eventDate,
    });
    expect(o.bridalGroups[0].trialDates).toEqual([b.trial.startsAt.toISOString()]);
    expect(o.contracts).toHaveLength(1);
    expect(o.contracts[0]).toMatchObject({
      id: b.contractId,
      code: b.code,
      totalAmount: '8000.00',
      paid: '1000.00',
      balance: '7000.00',
      nextDueDate: '2030-01-01',
      nextDueAmount: '1400.00',
    });
    expect(o.upcomingAppointments).toHaveLength(1);
    expect(o.upcomingAppointments[0]).toMatchObject({ kind: 'trial', bridalGroupId: b.groupId });
    expect(o.stats).toMatchObject({ completedCount: 0, totalSpent: '0.00', creditBalance: '0.00' });
  });

  it('acompanhante aparece com o papel certo e enxerga o contrato do grupo', async () => {
    const b = await bride();
    const r = await adm()(OVERVIEW, { id: b.companionClientIds[0] });
    const o = r.data.clientOverview;
    expect(o.bridalGroups).toHaveLength(1);
    expect(o.bridalGroups[0]).toMatchObject({ id: b.groupId, role: 'companion' });
    expect(o.contracts.map((c: { id: string }) => c.id)).toEqual([b.contractId]);
    expect(o.upcomingAppointments).toHaveLength(0);
  });

  it('historico: atendimento concluido, comanda fechada e pagamento de contrato', async () => {
    const b = await bride();
    const done = await mkAppt(b.brideClientId, -3 * DAY, { status: 'completed' });
    const comanda = await adminPrisma.comanda.create({
      data: {
        organizationId: w.orgId,
        code: `QC-${Date.now() % 100000}-${++seq}`,
        clientId: b.brideClientId,
        status: 'closed',
        total: '120.00',
        closedAt: new Date(Date.now() - 2 * DAY),
      },
    });
    await adminPrisma.comandaItem.create({
      data: {
        organizationId: w.orgId,
        comandaId: comanda.id,
        kind: 'service',
        serviceId: w.serviceId,
        professionalId: w.members.proA,
        nameSnapshot: 'Escova',
        quantity: 1,
        listUnitPrice: '120.00',
        unitPrice: '120.00',
        total: '120.00',
      },
    });
    const h = await adm()(HISTORY, { id: b.brideClientId });
    expect(h.errors).toBeUndefined();
    const items = h.data.clientHistory as { kind: string; entityType: string; amount: string }[];
    expect(items.map((i) => i.kind)).toEqual(['contract_payment', 'comanda', 'appointment']);
    expect(items[1]).toMatchObject({ entityType: 'comanda', amount: '120.00' });
    expect(items.find((i) => i.kind === 'contract_payment')).toMatchObject({
      entityType: 'contract',
      amount: '1000.00',
    });
    const only = await adm()(HISTORY, { id: b.brideClientId, f: { kind: 'appointment' } });
    expect(only.data.clientHistory).toHaveLength(1);
    expect(only.data.clientHistory[0].id).toBe(done.id);

    const o = (await adm()(OVERVIEW, { id: b.brideClientId })).data.clientOverview;
    expect(o.stats).toMatchObject({ completedCount: 1, totalSpent: '120.00' });
  });

  it('isolamento: outra organizacao nao enxerga a cliente', async () => {
    const b = await bride();
    const r = await gqlAs(w, w.tokens.otherAdmin)(OVERVIEW, { id: b.brideClientId });
    expect(r.data?.clientOverview ?? null).toBeNull();
    expect(r.errors?.length).toBeGreaterThan(0);
    const h = await gqlAs(w, w.tokens.otherAdmin)(HISTORY, { id: b.brideClientId });
    expect(h.data.clientHistory).toEqual([]);
  });
});
