import { randomUUID } from 'node:crypto';
import { adminPrisma, appPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';
import {
  ADD_ITEM,
  ADD_PAY,
  CLOSE,
  OPEN,
  REOPEN,
  buildFlow135,
  createServiceRule,
  type Payload,
} from './helpers/phase3-comanda-flow';

const COMANDA = `query($id: UUID!) { comanda(id: $id) { id code status items { id professionalId } } }`;
const SUMMARY = `query($f: String!, $t: String!) {
  financialSummary(from: $f, to: $t, granularity: "day") { billedTotal receivedTotal closedComandas }
}`;
const RECORDS = `query($f: String!, $t: String!) {
  commissionRecords(from: $f, to: $t) { id memberId calculatedAmount }
}`;
const MOVE = `mutation($i: MoveAppointmentInput!) { moveAppointment(input: $i) { errors { code message } } }`;
const CANCEL = `mutation($i: CancelAppointmentInput!) { cancelAppointment(input: $i) { errors { code message } } }`;
const BLOCK = `mutation($i: CreateTimeBlockInput!) { createTimeBlock(input: $i) { timeBlock { id } errors { code message } } }`;
const ADJUST = `mutation($i: AdjustClientCreditInput!) { adjustClientCredit(input: $i) { balance errors { code message } } }`;
const VISIT = `mutation($i: CreateVisitInput!) { createVisit(input: $i) { comandaId appointments { id } errors { code message } } }`;

const NINE_TABLES = [
  'time_blocks',
  'comandas',
  'comanda_sequences',
  'comanda_items',
  'comanda_payments',
  'client_credit_movements',
  'cash_movements',
  'commission_records',
  'audit_log',
] as const;

const range = () => {
  const d = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return { f: d(-1), t: d(2) };
};

// "Proibido" = erro GraphQL de topo com FORBIDDEN (PermissionGuard).
type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];

function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}

describe('Phase 3 - RLS e RBAC transversais', () => {
  let w: Phase3World;
  let comandaA: string;
  let apptA: string;
  let openComandaId: string;

  beforeAll(async () => {
    w = await createPhase3World('p3rls');
    const admin = gqlAs(w, w.tokens.admin);

    // regra 40% + fluxo fechado (comanda, itens, pagamentos, caixa, credito, comissao, estoque)
    await createServiceRule(w, w.serviceId, '40.00');
    const flow = await buildFlow135(w);
    comandaA = flow.comandaId;
    const closed = (await admin(CLOSE, { id: comandaA })).data.closeComanda as Payload;
    expect(closed.errors).toEqual([]);
    expect(closed.comanda!.status).toBe('closed');
    // reabre e fecha de novo: gera audit_log e reversoes de comissao/caixa
    const reopened = (await admin(REOPEN, { i: { id: comandaA, reason: 'conferencia RLS' } }))
      .data.reopenComanda as Payload;
    expect(reopened.errors).toEqual([]);
    const reclosed = (await admin(CLOSE, { id: comandaA })).data.closeComanda as Payload;
    expect(reclosed.errors).toEqual([]);

    // visita futura com sinal (appointment do proB) + bloqueio
    const day = '2031-03-12';
    const visit = await admin(VISIT, {
      i: {
        clientId: w.clientId,
        deposit: { amount: '30.00', method: 'pix' },
        items: [
          {
            serviceId: w.serviceId,
            professionalId: w.members.proB,
            startsAt: `${day}T13:00:00-03:00`,
            endsAt: `${day}T14:00:00-03:00`,
          },
        ],
      },
    });
    expect(visit.data.createVisit.errors).toEqual([]);
    apptA = visit.data.createVisit.appointments[0].id;
    const block = await admin(BLOCK, {
      i: {
        kind: 'intervalo',
        professionalId: w.members.proA,
        startsAt: `${day}T12:00:00-03:00`,
        endsAt: `${day}T12:30:00-03:00`,
      },
    });
    expect(block.data.createTimeBlock.errors).toEqual([]);

    // comanda aberta (com item da proA) para a matriz de papeis
    const opened = (await admin(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Payload;
    openComandaId = opened.comanda!.id;
    const item = (
      await admin(ADD_ITEM, {
        i: {
          comandaId: openComandaId,
          kind: 'service',
          serviceId: w.serviceBId,
          professionalId: w.members.proA,
          quantity: 1,
        },
      })
    ).data.addComandaItem as Payload;
    expect(item.errors).toEqual([]);
  }, 60_000);

  afterAll(async () => {
    await destroyPhase3World(w);
  });

  describe('RLS: org B nao enxerga nada da org A', () => {
    it('as 9 tabelas novas: org A tem linhas, org B enxerga 0', async () => {
      for (const table of NINE_TABLES) {
        const rowsA = await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id = '${w.orgId}'`,
        );
        expect(Number(rowsA[0].n)).toBeGreaterThan(0);

        const asB = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.current_organization', '${w.otherOrgId}', true)`,
          );
          return tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM ${table}`);
        });
        expect([table, Number(asB[0].n)]).toEqual([table, 0]);

        const asA = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.current_organization', '${w.orgId}', true)`,
          );
          return tx.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id <> '${w.orgId}'`,
          );
        });
        expect([table, Number(asA[0].n)]).toEqual([table, 0]);
      }
    });

    it('INSERT em comandas com organization_id da org A na sessao da org B viola a policy', async () => {
      await expect(
        appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.current_organization', '${w.otherOrgId}', true)`,
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO comandas (id, organization_id, code, status) VALUES ('${randomUUID()}', '${w.orgId}', 'C-HACK-001', 'open')`,
          );
        }),
      ).rejects.toThrow(/row-level security|violates/i);
    });
  });

  describe('GraphQL cross-tenant', () => {
    it('admin B: comanda da org A -> null', async () => {
      const r = await gqlAs(w, w.tokens.otherAdmin)(COMANDA, { id: comandaA });
      expect(r.errors).toBeUndefined();
      expect(r.data.comanda).toBeNull();
    });

    it('admin B: closeComanda / moveAppointment / cancelAppointment da org A -> NOT_FOUND', async () => {
      const b = gqlAs(w, w.tokens.otherAdmin);
      const close = await b(CLOSE, { id: openComandaId });
      expect(close.data.closeComanda.errors[0].code).toBe('NOT_FOUND');
      const move = await b(MOVE, {
        i: { id: apptA, professionalId: w.members.proB, startsAt: '2031-03-12T16:00:00-03:00' },
      });
      expect(move.data.moveAppointment.errors[0].code).toBe('NOT_FOUND');
      const cancel = await b(CANCEL, { i: { id: apptA, reason: 'teste cross-tenant' } });
      expect(cancel.data.cancelAppointment.errors[0].code).toBe('NOT_FOUND');
      const pay = await b(ADD_PAY, { i: { comandaId: openComandaId, method: 'cash', amount: '1.00' } });
      expect(pay.data.addComandaPayment.errors[0].code).toBe('NOT_FOUND');
    });

    it('admin B: financialSummary e commissionRecords nao contem valores da org A', async () => {
      const { f, t } = range();
      const a = await gqlAs(w, w.tokens.admin)(SUMMARY, { f, t });
      expect(Number(a.data.financialSummary.billedTotal)).toBeGreaterThan(0);
      const b = await gqlAs(w, w.tokens.otherAdmin)(SUMMARY, { f, t });
      expect(Number(b.data.financialSummary.billedTotal)).toBe(0);
      expect(Number(b.data.financialSummary.receivedTotal)).toBe(0);
      expect(b.data.financialSummary.closedComandas).toBe(0);
      const rec = await gqlAs(w, w.tokens.otherAdmin)(RECORDS, { f, t });
      expect(rec.data.commissionRecords).toEqual([]);
    });
  });

  describe('Matriz de permissoes por papel', () => {
    const missing = () => randomUUID();
    const { f, t } = range();

    type Row = {
      role: 'admin' | 'manager' | 'attendant' | 'proA';
      op: string;
      allowed: boolean;
      run: () => Promise<{ data?: unknown; errors?: GqlErrors }>;
    };

    const as = (role: Row['role']) => gqlAs(w, w.tokens[role]);

    const rows: Row[] = [
      // ATTENDANT
      { role: 'attendant', op: 'openWalkInComanda', allowed: true, run: () => as('attendant')(OPEN, { i: { clientId: w.clientId } }) },
      { role: 'attendant', op: 'addComandaPayment', allowed: true, run: () => as('attendant')(ADD_PAY, { i: { comandaId: openComandaId, method: 'cash', amount: '1.00' } }) },
      { role: 'attendant', op: 'closeComanda', allowed: true, run: () => as('attendant')(CLOSE, { id: openComandaId }) },
      { role: 'attendant', op: 'reopenComanda', allowed: false, run: () => as('attendant')(REOPEN, { i: { id: comandaA, reason: 'sem permissao' } }) },
      { role: 'attendant', op: 'adjustClientCredit', allowed: false, run: () => as('attendant')(ADJUST, { i: { clientId: w.clientId, amount: '5.00', reason: 'sem permissao' } }) },
      { role: 'attendant', op: 'financialSummary', allowed: false, run: () => as('attendant')(SUMMARY, { f, t }) },
      { role: 'attendant', op: 'createTimeBlock', allowed: true, run: () => as('attendant')(BLOCK, { i: { kind: 'intervalo', professionalId: w.members.proB, startsAt: '2031-03-13T12:00:00-03:00', endsAt: '2031-03-13T12:30:00-03:00' } }) },
      { role: 'attendant', op: 'cancelAppointment', allowed: true, run: () => as('attendant')(CANCEL, { i: { id: missing(), reason: 'teste matriz' } }) },
      // MANAGER
      { role: 'manager', op: 'reopenComanda', allowed: true, run: () => as('manager')(REOPEN, { i: { id: missing(), reason: 'teste matriz' } }) },
      { role: 'manager', op: 'adjustClientCredit', allowed: true, run: () => as('manager')(ADJUST, { i: { clientId: w.clientId, amount: '5.00', reason: 'teste matriz' } }) },
      { role: 'manager', op: 'financialSummary', allowed: true, run: () => as('manager')(SUMMARY, { f, t }) },
      { role: 'manager', op: 'closeComanda', allowed: true, run: () => as('manager')(CLOSE, { id: missing() }) },
      // ADMIN
      { role: 'admin', op: 'financialSummary', allowed: true, run: () => as('admin')(SUMMARY, { f, t }) },
      { role: 'admin', op: 'reopenComanda', allowed: true, run: () => as('admin')(REOPEN, { i: { id: missing(), reason: 'teste matriz' } }) },
      // PROFESSIONAL
      { role: 'proA', op: 'comanda (item proprio)', allowed: true, run: () => as('proA')(COMANDA, { id: comandaA }) },
      { role: 'proA', op: 'addComandaItem', allowed: false, run: () => as('proA')(ADD_ITEM, { i: { comandaId: openComandaId, kind: 'service', serviceId: w.serviceBId, professionalId: w.members.proA, quantity: 1 } }) },
      { role: 'proA', op: 'closeComanda', allowed: false, run: () => as('proA')(CLOSE, { id: openComandaId }) },
      { role: 'proA', op: 'moveAppointment', allowed: false, run: () => as('proA')(MOVE, { i: { id: apptA, professionalId: w.members.proB, startsAt: '2031-03-12T16:00:00-03:00' } }) },
      { role: 'proA', op: 'commissionRecords', allowed: true, run: () => as('proA')(RECORDS, { f, t }) },
      { role: 'proA', op: 'financialSummary', allowed: false, run: () => as('proA')(SUMMARY, { f, t }) },
    ];

    it('tem pelo menos 18 linhas', () => {
      expect(rows.length).toBeGreaterThanOrEqual(18);
    });

    // A ordem importa pouco: operacoes "permitidas" so usam ids inexistentes ou
    // falham por regra de negocio (payload errors), nunca por permissao.
    it.each(rows.map((r) => [r.role, r.op, r.allowed, r] as const))(
      '%s / %s -> permitido=%s',
      async (_role, _op, allowed, row) => {
        const res = await row.run();
        if (allowed) {
          expect(isForbidden(res)).toBe(false);
          expect(res.errors).toBeUndefined();
        } else {
          expect(isForbidden(res)).toBe(true);
        }
      },
    );

    it('PROFESSIONAL ve so as proprias comissoes e so a propria comanda', async () => {
      const own = await as('proA')(RECORDS, { f, t });
      expect(own.data.commissionRecords.length).toBeGreaterThan(0);
      for (const r of own.data.commissionRecords) expect(r.memberId).toBe(w.members.proA);

      const other = await as('proA')(RECORDS, { f, t });
      expect(other.errors).toBeUndefined();

      const proBView = await gqlAs(w, w.tokens.proB)(COMANDA, { id: comandaA });
      expect(proBView.data.comanda).toBeNull();
      const proBRecords = await gqlAs(w, w.tokens.proB)(RECORDS, { f, t });
      expect(proBRecords.data.commissionRecords).toEqual([]);
    });
  });
});
