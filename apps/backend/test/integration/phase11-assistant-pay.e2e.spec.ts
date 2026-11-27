import { adminPrisma } from './setup';
import { gqlAs } from './helpers/phase4-fixtures';
import {
  createPhase91World,
  destroyPhase91World,
  insertStudioBrideGroup,
  type Phase91World,
} from './helpers/phase91-fixtures';
import { ADD_ITEM, ADD_PAY, CLOSE, OPEN, type Payload } from './helpers/phase3-comanda-flow';

const SET = `mutation($g: UUID!, $m: UUID) {
  setBridalGroupAssistant(groupId: $g, memberId: $m) {
    group { id assistantMemberId } errors { code message field }
  }
}`;
const CREATE_RULE = `mutation($i: CreateCommissionRuleInput!) {
  createCommissionRule(input: $i) { errors { code message field } }
}`;

type UserErr = { code: string; message: string; field: string | null };

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

const TO_ASSISTANT = (id: string) =>
  `UPDATE members SET role_id = (SELECT id FROM roles WHERE name = 'ASSISTANT' AND is_system = true LIMIT 1)
    WHERE id = '${id}'::uuid`;

describe('11 G-01 — assistente só recebe a diária', () => {
  let w: Phase91World;
  let seq = 0;
  const D = localDay(60);

  beforeAll(async () => {
    w = await createPhase91World('zz1120');
    // a assistente "a" passa a ter o papel de sistema ASSISTANT
    await adminPrisma.$executeRawUnsafe(TO_ASSISTANT(w.assistants.a));
  });
  afterAll(async () => {
    await destroyPhase91World(w);
  });
  afterEach(async () => {
    const org = `'${w.orgId}'::uuid`;
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = NULL, assistant_daily_rate = NULL, assistant_linked_at = NULL
        WHERE organization_id = ${org}`,
    );
    for (const t of [
      'commission_records',
      'cash_movements',
      'comanda_payments',
      'comanda_items',
      'time_blocks',
    ]) {
      await adminPrisma.$executeRawUnsafe(`DELETE FROM ${t} WHERE organization_id = ${org}`);
    }
    await adminPrisma.$executeRawUnsafe(
      `UPDATE appointments SET comanda_id = NULL WHERE organization_id = ${org}`,
    );
    await adminPrisma.$executeRawUnsafe(`DELETE FROM comandas WHERE organization_id = ${org}`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM appointments WHERE organization_id = ${org}`);
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const adm = () => gqlAs(w, w.tokens.admin);
  const bind = async (groupId: string, memberId: string | null) =>
    (await att()(SET, { g: groupId, m: memberId })).data.setBridalGroupAssistant as {
      errors: UserErr[];
    };
  const brideOf = async (groupId: string) =>
    (await adminPrisma.bridalGroupMember.findFirstOrThrow({ where: { groupId, role: 'bride' } }))
      .clientId;

  /** Comanda do evento com um serviço de R$100 (item da profissional `proId`) pago em dinheiro. */
  async function mkComanda(groupId: string, clientId: string, proId: string): Promise<string> {
    const n = ++seq;
    const start = new Date(Date.now() - (n + 1) * 3 * 3_600_000);
    const comanda = await adminPrisma.comanda.create({
      data: {
        organizationId: w.orgId,
        code: `A11-${Date.now() % 100000}-${n}`,
        clientId,
        status: 'open',
      },
    });
    const appt = await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId,
        serviceId: w.serviceId,
        startsAt: start,
        endsAt: new Date(start.getTime() + 3_600_000),
        status: 'completed',
        comandaId: comanda.id,
        bridalGroupId: groupId,
        purpose: 'event',
      } as never,
    });
    await adminPrisma.comandaItem.create({
      data: {
        organizationId: w.orgId,
        comandaId: comanda.id,
        kind: 'service',
        serviceId: w.serviceId,
        professionalId: proId,
        appointmentId: appt.id,
        nameSnapshot: 'Maquiagem',
        listUnitPrice: '100.00',
        unitPrice: '100.00',
        total: '100.00',
      } as never,
    });
    const pay = (
      await att()(ADD_PAY, { i: { comandaId: comanda.id, method: 'cash', amount: '100.00' } })
    ).data.addComandaPayment as Payload;
    expect(pay.errors).toEqual([]);
    return comanda.id;
  }
  const close = async (id: string) => (await att()(CLOSE, { id })).data.closeComanda as Payload;
  const accruals = (comandaId: string, memberId: string) =>
    adminPrisma.$queryRawUnsafe<{ n: string; amt: string }[]>(
      `SELECT rule_snapshot->>'itemName' AS n, calculated_amount::text AS amt FROM commission_records
        WHERE comanda_id = '${comandaId}'::uuid AND member_id = '${memberId}'::uuid AND kind = 'accrual'`,
    );

  it('recusa adicionar item de comanda com a assistente', async () => {
    const open = (await att()(OPEN, { i: { clientId: w.clientId } })).data
      .openWalkInComanda as Payload;
    expect(open.errors).toEqual([]);
    const r = (
      await att()(ADD_ITEM, {
        i: {
          comandaId: open.comanda!.id,
          kind: 'service',
          serviceId: w.serviceId,
          professionalId: w.assistants.a,
          quantity: 1,
        },
      })
    ).data.addComandaItem as Payload;
    expect(r.errors[0].code).toBe('PROFESSIONAL_IS_ASSISTANT');
  });

  it('recusa regra de comissão member_service para a assistente', async () => {
    const r = (
      await adm()(CREATE_RULE, {
        i: {
          scopeType: 'member_service',
          kind: 'percentage',
          value: '10',
          memberId: w.assistants.a,
          serviceId: w.serviceId,
        },
      })
    ).data.createCommissionRule as { errors: UserErr[] };
    expect(r.errors[0].code).toBe('PROFESSIONAL_IS_ASSISTANT');
  });

  it('item antigo de quem virou assistente não gera comissão e a diária segue', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    expect((await bind(g.groupId, w.assistants.a)).errors).toEqual([]);
    // b ainda é profissional comum: o item é criado e só depois ela vira ASSISTANT
    const comandaId = await mkComanda(g.groupId, await brideOf(g.groupId), w.assistants.b);
    await adminPrisma.$executeRawUnsafe(TO_ASSISTANT(w.assistants.b));
    expect((await close(comandaId)).errors).toEqual([]);
    const bRows = await adminPrisma.commissionRecord.findMany({
      where: { comandaId, memberId: w.assistants.b },
    });
    expect(bRows).toHaveLength(0);
    expect(await accruals(comandaId, w.assistants.a)).toHaveLength(1);
  });

  it('noiva no estúdio: fechar paga a diária "Assistente da Noiva"', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    expect((await bind(g.groupId, w.assistants.a)).errors).toEqual([]);
    const comandaId = await mkComanda(g.groupId, await brideOf(g.groupId), w.members.proA);
    expect((await close(comandaId)).errors).toEqual([]);
    const rows = await accruals(comandaId, w.assistants.a);
    expect(rows).toHaveLength(1);
    expect(rows[0].n).toMatch(/^Assistente da Noiva — /);
    expect(rows[0].amt).toBe('220.00');
  });

  it('debutante no estúdio com pacote marcado: fechar paga "Assistente da Debutante"', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D, eventKind: 'debutante' });
    expect((await bind(g.groupId, w.assistants.a)).errors).toEqual([]);
    const comandaId = await mkComanda(g.groupId, await brideOf(g.groupId), w.members.proA);
    expect((await close(comandaId)).errors).toEqual([]);
    const rows = await accruals(comandaId, w.assistants.a);
    expect(rows).toHaveLength(1);
    expect(rows[0].n).toMatch(/^Assistente da Debutante — /);
  });
});
