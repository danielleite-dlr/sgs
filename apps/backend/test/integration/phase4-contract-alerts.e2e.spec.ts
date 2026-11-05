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
import { EMAIL_ADAPTER } from '../../src/email/email.module';
import type { TestEmailAdapter } from '../../src/email/test-email.adapter';
import { ContractAlertsService } from '../../src/contracts/alerts/contract-alerts.service';

const NOW = new Date('2030-06-10T15:00:00.000Z'); // 12:00 em São Paulo
const DAY = 24 * 3600 * 1000;
const RUN_NOW = `mutation { runContractAlertsNow { ran candidates created resolved emailed } }`;
const NOTIFS = `query { notifications(unreadOnly: true) { id kind } }`;

describe('Phase 4 - alertas automáticos de contrato (CONT-02)', () => {
  let w: Phase4World;
  let svc: ContractAlertsService;
  let mail: TestEmailAdapter;
  const orgFilter = () => `SELECT id FROM organizations WHERE legal_name LIKE '${w.prefix}-%'`;

  beforeAll(async () => {
    w = await createPhase4World('p4alert');
    svc = w.app.get(ContractAlertsService);
    mail = w.app.get(EMAIL_ADAPTER) as TestEmailAdapter;
  });

  afterAll(async () => {
    await destroyPhase4World(w);
  });

  beforeEach(() => {
    mail.reset();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid AND bridal_group_id IS NOT NULL`,
    );
    await deletePhase4Rows(orgFilter());
  });

  async function mkContract(o: {
    status?: string;
    balanceDueDate: string;
    paid?: string;
    acceptedAt?: string;
    linkGeneratedAt?: string;
    eventDate?: string;
    paymentMode?: 'sinal' | 'sinal_parcelado' | 'a_vista';
    installments?: { seq: number; amount: string; dueDate: string }[];
  }) {
    const g = await insertBridalGroupRow(w, { eventDate: o.eventDate ?? '2030-08-01' });
    const c = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '8000.00',
      depositAmount: '2400.00',
      status: o.status ?? 'active',
      balanceDueDate: o.balanceDueDate,
      paymentMode: o.paymentMode,
      installments: o.installments,
    });
    await adminPrisma.contract.update({
      where: { id: c.contractId },
      data: {
        acceptedAt: o.acceptedAt ? new Date(o.acceptedAt) : null,
        linkGeneratedAt: o.linkGeneratedAt ? new Date(o.linkGeneratedAt) : null,
        createdAt: new Date('2030-05-01T12:00:00.000Z'),
      },
    });
    if (o.paid) await pay(c.contractId, o.paid);
    return { ...c, groupId: g.groupId };
  }

  const pay = (contractId: string, amount: string) =>
    adminPrisma.contractPayment.create({
      data: { organizationId: w.orgId, contractId, kind: 'payment', method: 'pix', amount },
    });

  const rows = (contractId?: string) =>
    adminPrisma.notification.findMany({
      where: {
        organizationId: w.orgId,
        kind: { startsWith: 'contract_' },
        ...(contractId ? { payload: { path: ['contractId'], equals: contractId } } : {}),
      },
    });

  it('restante vencendo em 3 dias notifica só ADMIN/MANAGER e o atendente não vê', async () => {
    const c = await mkContract({
      balanceDueDate: '2030-06-13',
      paid: '6400.00',
      acceptedAt: '2030-05-02T12:00:00.000Z',
    });
    const r = await svc.runForOrg(w.orgId, NOW);
    expect(r).toMatchObject({ ran: true, candidates: 1, created: 2 });

    const list = await rows(c.contractId);
    expect(list.map((n) => n.kind)).toEqual(['contract_balance_due_soon', 'contract_balance_due_soon']);
    expect(list.map((n) => n.memberId).sort()).toEqual([w.members.admin, w.members.manager].sort());
    expect(
      await adminPrisma.notification.count({
        where: { organizationId: w.orgId, memberId: { in: [w.members.attendant, w.members.proA] } },
      }),
    ).toBe(0);

    const adm = await gqlAs(w, w.tokens.admin)(NOTIFS);
    expect(adm.data.notifications.map((n: { kind: string }) => n.kind)).toContain(
      'contract_balance_due_soon',
    );
    const att = await gqlAs(w, w.tokens.attendant)(NOTIFS);
    expect(
      att.data.notifications.filter((n: { kind: string }) => n.kind.startsWith('contract_')),
    ).toHaveLength(0);
  });

  it('roda uma vez por dia, deduplica, vira vencido e auto-resolve ao quitar', async () => {
    const c = await mkContract({
      balanceDueDate: '2030-06-13',
      paid: '6400.00',
      acceptedAt: '2030-05-02T12:00:00.000Z',
    });
    await svc.runForOrg(w.orgId, NOW);

    const again = await svc.runForOrg(w.orgId, NOW);
    expect(again).toMatchObject({ ran: false, created: 0 });

    // dia seguinte: mesmo estado => sem duplicar
    const d2 = new Date(NOW.getTime() + DAY);
    const r2 = await svc.runForOrg(w.orgId, d2);
    expect(r2).toMatchObject({ ran: true, candidates: 1, created: 0, resolved: 0 });
    expect(await rows(c.contractId)).toHaveLength(2);

    // prazo passa para ontem => novo estado (overdue) e a due_soon aberta é resolvida
    await adminPrisma.contract.update({
      where: { id: c.contractId },
      data: { balanceDueDate: new Date('2030-06-10T00:00:00.000Z') },
    });
    const d3 = new Date(NOW.getTime() + 2 * DAY);
    const r3 = await svc.runForOrg(w.orgId, d3);
    expect(r3).toMatchObject({ ran: true, candidates: 1, created: 2, resolved: 2 });
    const list = await rows(c.contractId);
    expect(list.filter((n) => n.kind === 'contract_balance_overdue' && !n.readAt)).toHaveLength(2);
    expect(list.filter((n) => n.kind === 'contract_balance_due_soon' && n.readAt)).toHaveLength(2);

    // quitado => overdue resolvida, nenhum candidato
    await pay(c.contractId, '1600.00');
    const r4 = await svc.runForOrg(w.orgId, new Date(NOW.getTime() + 3 * DAY));
    expect(r4).toMatchObject({ ran: true, candidates: 0, created: 0, resolved: 2 });
    expect((await rows(c.contractId)).filter((n) => !n.readAt)).toHaveLength(0);
  });

  it('entrada não paga e contrato não aceito', async () => {
    const dep = await mkContract({
      balanceDueDate: '2030-08-01',
      acceptedAt: '2030-06-07T15:00:00.000Z',
    });
    const naw = await mkContract({
      status: 'awaiting_acceptance',
      balanceDueDate: '2030-08-01',
      linkGeneratedAt: '2030-06-07T15:00:00.000Z',
    });
    const r = await svc.runForOrg(w.orgId, NOW);
    expect(r.candidates).toBe(2);
    expect((await rows(dep.contractId)).map((n) => n.kind)).toContain('contract_deposit_unpaid');
    expect((await rows(naw.contractId)).map((n) => n.kind)).toContain('contract_not_accepted');
  });

  it('parcela do sinal vencida: ADMIN/MANAGER, dedupe, nova data gera novo alerta, pagamento resolve, e-mail', async () => {
    const c = await mkContract({
      balanceDueDate: '2030-09-01',
      eventDate: '2030-09-10',
      acceptedAt: '2030-06-01T12:00:00.000Z',
      paymentMode: 'sinal_parcelado',
      installments: [
        { seq: 1, amount: '200.00', dueDate: '2030-06-09' },
        { seq: 2, amount: '200.00', dueDate: '2030-07-20' },
      ],
    });
    const r = await svc.runForOrg(w.orgId, NOW);
    expect(r).toMatchObject({ ran: true, candidates: 1, created: 2 });
    const list = await rows(c.contractId);
    expect(list.map((n) => n.kind)).toEqual([
      'contract_installment_overdue',
      'contract_installment_overdue',
    ]);
    expect(list.map((n) => n.memberId).sort()).toEqual([w.members.admin, w.members.manager].sort());
    expect(
      await adminPrisma.notification.count({
        where: { organizationId: w.orgId, memberId: { in: [w.members.attendant, w.members.proA] } },
      }),
    ).toBe(0);
    expect(mail.all.some((m) => (m.text ?? '').includes('Parcela do sinal vencida'))).toBe(true);

    // mesmo dia: não roda; dia seguinte: mesmo estado, sem duplicar
    expect(await svc.runForOrg(w.orgId, NOW)).toMatchObject({ ran: false, created: 0 });
    expect(await svc.runForOrg(w.orgId, new Date(NOW.getTime() + DAY))).toMatchObject({
      candidates: 1,
      created: 0,
    });

    // mudar o vencimento => novo estado, novo alerta
    await adminPrisma.contractDepositInstallment.updateMany({
      where: { contractId: c.contractId, seq: 1 },
      data: { dueDate: new Date('2030-06-08T00:00:00.000Z') },
    });
    const r3 = await svc.runForOrg(w.orgId, new Date(NOW.getTime() + 2 * DAY));
    expect(r3).toMatchObject({ candidates: 1, created: 2, resolved: 2 });

    // pagamento cobrindo a parcela => nada novo, alerta resolvido
    await pay(c.contractId, '200.00');
    const r4 = await svc.runForOrg(w.orgId, new Date(NOW.getTime() + 3 * DAY));
    expect(r4).toMatchObject({ candidates: 0, created: 0, resolved: 2 });
  });

  it('pagamento à vista vencido não gera alertas do restante', async () => {
    const c = await mkContract({
      balanceDueDate: '2030-06-01',
      eventDate: '2030-06-20',
      acceptedAt: '2030-06-01T12:00:00.000Z',
      paymentMode: 'a_vista',
      installments: [{ seq: 1, amount: '8000.00', dueDate: '2030-06-09' }],
    });
    await svc.runForOrg(w.orgId, NOW);
    const list = await rows(c.contractId);
    expect(list.map((n) => n.kind)).toEqual([
      'contract_installment_overdue',
      'contract_installment_overdue',
    ]);
    expect((list[0].payload as { title: string }).title).toBe('Pagamento à vista vencido');
  });

  it('sinal de acompanhante avulsa pendente perto do evento', async () => {
    const g = await insertBridalGroupRow(w, { eventDate: '2030-06-20', companions: 1 });
    await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: g.companionClientIds[0],
        serviceId: w.serviceId,
        startsAt: new Date('2030-06-18T13:00:00.000Z'),
        endsAt: new Date('2030-06-18T14:00:00.000Z'),
        bridalGroupId: g.groupId,
        depositAmount: '0.00',
      },
    });
    const r = await svc.runForOrg(w.orgId, NOW);
    expect(r).toMatchObject({ candidates: 1, created: 2 });
    const n = await adminPrisma.notification.findFirstOrThrow({
      where: { organizationId: w.orgId, kind: 'bridal_companion_deposit_pending' },
    });
    expect((n.payload as { groupId: string }).groupId).toBe(g.groupId);
  });

  it('usa a data local da org (Pitfall 9): 02:30Z de 10/12 ainda é 09/12 em São Paulo', async () => {
    const c = await mkContract({
      balanceDueDate: '2026-12-12',
      paid: '6400.00',
      acceptedAt: '2026-11-01T12:00:00.000Z',
      eventDate: '2027-02-01',
    });
    const r = await svc.runForOrg(w.orgId, new Date('2026-12-10T02:30:00Z'));
    expect(r.candidates).toBe(1);
    const n = (await rows(c.contractId))[0];
    expect(n.kind).toBe('contract_balance_due_soon');
    expect((n.payload as { title: string }).title).toBe('Restante vence em 3 dia(s)');
    const run = await adminPrisma.$queryRawUnsafe<{ d: string }[]>(
      `SELECT to_char(run_date, 'YYYY-MM-DD') AS d FROM contract_alert_runs WHERE organization_id = '${w.orgId}'::uuid`,
    );
    expect(run.map((x) => x.d)).toEqual(['2026-12-09']);
  });

  it('e-mail de resumo por destinatário; sem pendências, nenhum e-mail', async () => {
    await mkContract({
      balanceDueDate: '2030-06-13',
      paid: '6400.00',
      acceptedAt: '2030-05-02T12:00:00.000Z',
    });
    const r = await svc.runForOrg(w.orgId, NOW);
    expect(r.emailed).toBe(2);
    const sent = mail.all.filter((m) => m.subject.startsWith('Pendências de contratos'));
    expect(sent).toHaveLength(2);
    const adminUser = await adminPrisma.member.findUniqueOrThrow({
      where: { id: w.members.admin },
      include: { user: true },
    });
    const mine = mail.findByRecipient(adminUser.user.email);
    expect(mine).toHaveLength(1);
    expect(mine[0].text).toContain('Restante vence em 3 dia(s)');
    expect(mine[0].html).toContain('<ul>');

    await deletePhase4Rows(orgFilter());
    mail.reset();
    const r2 = await svc.runForOrg(w.orgId, new Date(NOW.getTime() + 5 * DAY));
    expect(r2).toMatchObject({ ran: true, candidates: 0, emailed: 0 });
    expect(mail.all).toHaveLength(0);
  });

  it('tick roda só orgs elegíveis (hora local >= 8h) e runContractAlertsNow respeita papel e org', async () => {
    await adminPrisma.organization.update({
      where: { id: w.otherOrgId },
      data: { timezone: 'Pacific/Honolulu' },
    });
    // mock: o tick varre todas as orgs ativas do banco compartilhado; só observamos as chamadas
    const spy = jest
      .spyOn(svc, 'runForOrg')
      .mockResolvedValue({ ran: false, candidates: 0, created: 0, resolved: 0, emailed: 0 });
    await svc.tick(new Date('2030-06-10T12:00:00.000Z')); // SP 09:00, Honolulu 02:00
    const called = spy.mock.calls.map((c) => c[0]);
    expect(called).toContain(w.orgId);
    expect(called).not.toContain(w.otherOrgId);

    spy.mockClear();
    await svc.tick(new Date('2030-06-10T10:00:00.000Z')); // SP 07:00
    expect(spy.mock.calls.map((c) => c[0])).not.toContain(w.orgId);
    spy.mockRestore();

    // mutation: gerente dispara só a própria org (usa a data real)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(),
    );
    const due = new Date(Date.parse(`${today}T00:00:00Z`) + 3 * DAY).toISOString().slice(0, 10);
    await mkContract({
      balanceDueDate: due,
      paid: '6400.00',
      acceptedAt: '2030-05-02T12:00:00.000Z',
    });
    const mgr = await gqlAs(w, w.tokens.manager)(RUN_NOW);
    expect(mgr.errors).toBeUndefined();
    expect(mgr.data.runContractAlertsNow).toMatchObject({ ran: true, candidates: 1, created: 2 });
    expect(
      await adminPrisma.notification.count({ where: { organizationId: w.otherOrgId } }),
    ).toBe(0);

    const att = await gqlAs(w, w.tokens.attendant)(RUN_NOW);
    expect(att.errors?.length).toBeGreaterThan(0);
  });
});
