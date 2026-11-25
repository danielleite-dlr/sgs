import { adminPrisma } from './setup';
import { gqlAs } from './helpers/phase4-fixtures';
import {
  createPhase91World,
  destroyPhase91World,
  insertStudioBrideGroup,
  type Phase91World,
} from './helpers/phase91-fixtures';
import { ADD_PAY, CLOSE, REOPEN, range, type Payload } from './helpers/phase3-comanda-flow';

const SET = `mutation($g: UUID!, $m: UUID) {
  setBridalGroupAssistant(groupId: $g, memberId: $m) {
    group { id assistantMemberId assistantDailyRate } warning errors { code message field }
  }
}`;
const UPDATE_GROUP = `mutation($id: UUID!, $input: BridalGroupFieldsInput!) {
  updateBridalGroup(id: $id, input: $input) {
    group { id assistantMemberId } warning errors { code message field }
  }
}`;
const CANCEL = `mutation($input: CancelBridalGroupInput!) {
  cancelBridalGroup(input: $input) { group { id status } errors { code message field } }
}`;
const DELETE_GROUP = `mutation($id: UUID!) {
  deleteBridalGroupPermanently(id: $id) { deletedId errors { code message } }
}`;
const DELETE_MEMBER = `mutation($id: UUID!) {
  deleteMemberPermanently(id: $id) { deletedId errors { code message } }
}`;
const RECORDS = `query($f: String!, $t: String!, $m: UUID) {
  commissionRecords(from: $f, to: $t, memberId: $m) {
    memberId kind cycle itemName calculatedAmount reversed
  }
  commissionTotals(from: $f, to: $t, memberId: $m) { memberId total records }
}`;

/** YYYY-MM-DD de hoje + n dias no fuso de São Paulo (fuso padrão das orgs de teste). */
function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

/** Meia-noite local de São Paulo (UTC-3) como instante ISO. */
function dayStart(day: string): string {
  return `${day}T03:00:00.000Z`;
}

type UserErr = { code: string; message: string; field: string | null };

describe('09.1 — ciclo da assistente: repasse, cancelamento e mudanças do grupo', () => {
  let w: Phase91World;
  const D = localDay(40);
  const D1 = localDay(41);
  const D2 = localDay(42);
  let seq = 0;

  beforeAll(async () => {
    w = await createPhase91World('p91c');
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
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM contract_settings WHERE organization_id = ${org}`,
    );
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const adm = () => gqlAs(w, w.tokens.admin);
  const bind = async (groupId: string, memberId: string | null) => {
    const r = await att()(SET, { g: groupId, m: memberId });
    return r.data.setBridalGroupAssistant as {
      group: { assistantMemberId: string | null; assistantDailyRate: string | null } | null;
      warning: string | null;
      errors: UserErr[];
    };
  };
  const escortBlocks = (groupId: string) =>
    adminPrisma.$queryRawUnsafe<{ professional_id: string; starts_at: Date; ends_at: Date }[]>(
      `SELECT professional_id, starts_at, ends_at FROM time_blocks
        WHERE bridal_group_id = '${groupId}'::uuid AND kind = 'acompanhamento'`,
    );
  const accruals = (memberId: string) =>
    adminPrisma.commissionRecord.findMany({
      where: { organizationId: w.orgId, memberId },
      orderBy: { createdAt: 'asc' },
    });
  const groupRow = (id: string) => adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id } });
  const groupInput = async (id: string, extra: Record<string, unknown> = {}) => {
    const g = await groupRow(id);
    return {
      name: g.name,
      eventDate: g.eventDate.toISOString().slice(0, 10),
      locationKind: g.locationKind,
      ...extra,
    };
  };

  /** Comanda da cliente `clientId` com um serviço de R$100 já pago em dinheiro. */
  async function mkComanda(
    groupId: string,
    clientId: string,
    purpose: 'event' | 'trial',
  ): Promise<string> {
    const n = ++seq;
    const start = new Date(Date.now() - (n + 1) * 3 * 3_600_000);
    const comanda = await adminPrisma.comanda.create({
      data: { organizationId: w.orgId, code: `CIC-${Date.now() % 100000}-${n}`, clientId, status: 'open' },
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
        purpose,
      } as never,
    });
    await adminPrisma.comandaItem.create({
      data: {
        organizationId: w.orgId,
        comandaId: comanda.id,
        kind: 'service',
        serviceId: w.serviceId,
        professionalId: w.members.proA,
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
  const close = async (id: string) =>
    (await att()(CLOSE, { id })).data.closeComanda as Payload;
  const total = async (id: string) =>
    (await adminPrisma.$queryRawUnsafe<{ t: string }[]>(
      `SELECT total::text AS t FROM comandas WHERE id = '${id}'::uuid`,
    ))[0].t;
  const brideOf = async (groupId: string) =>
    (await adminPrisma.bridalGroupMember.findFirstOrThrow({ where: { groupId, role: 'bride' } }))
      .clientId;
  const linked = async (groupId: string, assistant: string) => {
    const g = await bind(groupId, assistant);
    expect(g.errors).toEqual([]);
  };

  it('fechar a comanda da noiva paga a diária sem mudar o total (AN-07)', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g.groupId, w.assistants.a);
    const comandaId = await mkComanda(g.groupId, await brideOf(g.groupId), 'event');
    const r = await close(comandaId);
    expect(r.errors).toEqual([]);
    // total = soma dos itens (R$100); a diária de R$220 não entra
    expect(await total(comandaId)).toBe('100.00');

    const rows = await adminPrisma.$queryRawUnsafe<
      {
        calculated_amount: string;
        comanda_item_id: string;
        kind: string;
        snap_kind: string;
        item_name: string;
      }[]
    >(
      `SELECT calculated_amount::text, comanda_item_id, kind,
              rule_snapshot->>'kind' AS snap_kind, rule_snapshot->>'itemName' AS item_name
         FROM commission_records
        WHERE comanda_id = '${comandaId}'::uuid AND member_id = '${w.assistants.a}'::uuid`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      calculated_amount: '220.00',
      comanda_item_id: g.groupId,
      kind: 'accrual',
      snap_kind: 'bridal_assistant',
    });
    const grp = await groupRow(g.groupId);
    expect(rows[0].item_name).toBe(`Assistente da Noiva — ${grp.name}`);

    const { from, to } = range();
    const d = (await adm()(RECORDS, { f: from, t: to, m: w.assistants.a })).data;
    expect(d.commissionRecords).toHaveLength(1);
    expect(d.commissionRecords[0]).toMatchObject({
      memberId: w.assistants.a,
      calculatedAmount: '220.00',
      itemName: `Assistente da Noiva — ${grp.name}`,
    });
    expect(d.commissionTotals).toEqual([{ memberId: w.assistants.a, total: '220.00', records: 1 }]);
  });

  it('comanda da madrinha e comanda de teste não pagam a diária', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g.groupId, w.assistants.a);
    // madrinha: cliente que não é a noiva do grupo
    const madrinha = await mkComanda(g.groupId, w.clientId, 'event');
    expect((await close(madrinha)).errors).toEqual([]);
    // teste da noiva
    const teste = await mkComanda(g.groupId, await brideOf(g.groupId), 'trial');
    expect((await close(teste)).errors).toEqual([]);
    expect(await accruals(w.assistants.a)).toHaveLength(0);
  });

  it('reabrir reverte a diária; fechar de novo paga quem está vinculada (D-13)', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g.groupId, w.assistants.a);
    const comandaId = await mkComanda(g.groupId, await brideOf(g.groupId), 'event');
    expect((await close(comandaId)).errors).toEqual([]);

    // com a comanda fechada não troca
    const blocked = await bind(g.groupId, w.assistants.b);
    expect(blocked.errors.map((e) => e.code)).toEqual(['EVENT_COMANDA_CLOSED']);

    const re = (await adm()(REOPEN, { i: { id: comandaId, reason: 'trocar assistente' } })).data
      .reopenComanda as Payload;
    expect(re.errors).toEqual([]);
    const rowsA = await accruals(w.assistants.a);
    expect(rowsA.map((r) => r.kind).sort()).toEqual(['accrual', 'reversal']);
    const { from, to } = range();
    const t = (await adm()(RECORDS, { f: from, t: to, m: w.assistants.a })).data;
    expect(t.commissionTotals.every((x: { total: string }) => Number(x.total) === 0)).toBe(true);

    await linked(g.groupId, w.assistants.b);
    expect((await close(comandaId)).errors).toEqual([]);
    const rowsB = await accruals(w.assistants.b);
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0]).toMatchObject({ kind: 'accrual', cycle: 2 });
    expect(rowsB[0].calculatedAmount.toString()).toBe('220');
    expect(await accruals(w.assistants.a)).toHaveLength(2); // nada novo para a
  });

  it('duas comandas de evento da noiva pagam a diária uma vez só', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g.groupId, w.assistants.a);
    const bride = await brideOf(g.groupId);
    const c1 = await mkComanda(g.groupId, bride, 'event');
    const c2 = await mkComanda(g.groupId, bride, 'event');
    expect((await close(c1)).errors).toEqual([]);
    expect((await close(c2)).errors).toEqual([]);
    expect(await accruals(w.assistants.a)).toHaveLength(1);
  });

  it('grupo cancelado: bloqueio some e a diária não é paga (D-12)', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g.groupId, w.assistants.a);
    expect(await escortBlocks(g.groupId)).toHaveLength(1);
    const comandaId = await mkComanda(g.groupId, await brideOf(g.groupId), 'event');

    const r = await adm()(CANCEL, { input: { id: g.groupId, reason: 'Evento cancelado' } });
    expect(r.data.cancelBridalGroup.errors).toEqual([]);
    expect(await escortBlocks(g.groupId)).toHaveLength(0);

    expect((await close(comandaId)).errors).toEqual([]);
    expect(await accruals(w.assistants.a)).toHaveLength(0);
  });

  it('mudar o local para externo remove a assistente e libera a agenda (D-05)', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g.groupId, w.assistants.a);
    const r = (
      await adm()(UPDATE_GROUP, {
        id: g.groupId,
        input: await groupInput(g.groupId, {
          locationKind: 'external',
          locationAddress: 'Rua do Evento, 100',
        }),
      })
    ).data.updateBridalGroup;
    expect(r.errors).toEqual([]);
    expect(r.warning).toContain('foi removida');
    expect(r.warning).toContain('evento fora do estúdio');
    expect((await groupRow(g.groupId)).assistantMemberId).toBeNull();
    expect(await escortBlocks(g.groupId)).toHaveLength(0);
  });

  it('trocar para pacote sem assistente remove a assistente (D-05)', async () => {
    const pkg = await adminPrisma.package.create({
      data: {
        organizationId: w.orgId,
        name: `p91c-pacote-sem-${Date.now()}`,
        price: '300.00',
        depositKind: 'percent',
        depositValue: '30.00',
        services: { create: [{ serviceId: w.serviceId, quantity: 1, displayOrder: 0 }] },
      },
    });
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g.groupId, w.assistants.a);
    const r = (
      await adm()(UPDATE_GROUP, {
        id: g.groupId,
        input: await groupInput(g.groupId, { packageId: pkg.id }),
      })
    ).data.updateBridalGroup;
    expect(r.errors).toEqual([]);
    expect(r.warning).toContain('foi removida');
    expect(r.warning).toContain('o pacote não inclui assistente da noiva');
    expect((await groupRow(g.groupId)).assistantMemberId).toBeNull();
    expect(await escortBlocks(g.groupId)).toHaveLength(0);
  });

  it('mudar a data move o bloqueio e mantém a diária guardada (D-08)', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g.groupId, w.assistants.a);
    const rate = (await groupRow(g.groupId)).assistantDailyRate?.toString();
    const r = (
      await adm()(UPDATE_GROUP, {
        id: g.groupId,
        input: await groupInput(g.groupId, { eventDate: D1 }),
      })
    ).data.updateBridalGroup;
    expect(r.errors).toEqual([]);
    expect(r.warning).toBeNull();
    const blocks = await escortBlocks(g.groupId);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].starts_at.toISOString()).toBe(dayStart(D1));
    expect(blocks[0].ends_at.toISOString()).toBe(dayStart(D2));
    expect((await groupRow(g.groupId)).assistantDailyRate?.toString()).toBe(rate);
  });

  it('mudar a data com a assistente ocupada falha com ASSISTANT_BUSY_ON_NEW_DATE', async () => {
    const g5 = await insertStudioBrideGroup(w, { eventDate: D1 });
    await linked(g5.groupId, w.assistants.a);
    const g6 = await insertStudioBrideGroup(w, { eventDate: D2 });
    await linked(g6.groupId, w.assistants.a);
    const r = (
      await adm()(UPDATE_GROUP, {
        id: g5.groupId,
        input: await groupInput(g5.groupId, { eventDate: D2 }),
      })
    ).data.updateBridalGroup;
    expect(r.errors.map((e: UserErr) => e.code)).toEqual(['ASSISTANT_BUSY_ON_NEW_DATE']);
    expect((await groupRow(g5.groupId)).eventDate.toISOString().slice(0, 10)).toBe(D1);
    const blocks = await escortBlocks(g5.groupId);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].starts_at.toISOString()).toBe(dayStart(D1));
  });

  it('reconstruir os deslocamentos não apaga o bloqueio acompanhamento (Pitfall 3)', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g.groupId, w.assistants.a);
    const r = (
      await adm()(UPDATE_GROUP, {
        id: g.groupId,
        input: await groupInput(g.groupId, { travelMinutesBefore: 20 }),
      })
    ).data.updateBridalGroup;
    expect(r.errors).toEqual([]);
    expect(await escortBlocks(g.groupId)).toHaveLength(1);
    expect((await groupRow(g.groupId)).assistantMemberId).toBe(w.assistants.a);
  });

  it('exclusão definitiva da profissional e do grupo com assistente e repasse', async () => {
    // grupo com repasse pago: apagar o grupo leva a comanda e o accrual junto
    const g1 = await insertStudioBrideGroup(w, { eventDate: D });
    await linked(g1.groupId, w.assistants.a);
    const comandaId = await mkComanda(g1.groupId, await brideOf(g1.groupId), 'event');
    expect((await close(comandaId)).errors).toEqual([]);
    expect(await accruals(w.assistants.a)).toHaveLength(1);
    const del = (await adm()(DELETE_GROUP, { id: g1.groupId })).data.deleteBridalGroupPermanently;
    expect(del.errors).toEqual([]);
    expect(del.deletedId).toBe(g1.groupId);

    // profissional vinculada a outro grupo: o vínculo é zerado e a exclusão passa
    const g2 = await insertStudioBrideGroup(w, { eventDate: D1 });
    await linked(g2.groupId, w.assistants.b);
    const out = (await adm()(DELETE_MEMBER, { id: w.assistants.b })).data.deleteMemberPermanently;
    expect(out.errors).toEqual([]);
    expect(out.deletedId).toBe(w.assistants.b);
    const row = await groupRow(g2.groupId);
    expect(row.assistantMemberId).toBeNull();
    expect(row.assistantDailyRate).toBeNull();
    expect(await escortBlocks(g2.groupId)).toHaveLength(0);
  });
});
