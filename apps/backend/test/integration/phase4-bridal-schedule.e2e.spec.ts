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

const SCHEDULE = `mutation($input: ScheduleBridalEventInput!) {
  scheduleBridalEvent(input: $input) {
    appointmentIds
    group { id appointmentCount appointments { id groupMemberId status purpose covered comandaId comandaStatus } }
    errors { code message field }
  }
}`;
const CANCEL = `mutation($input: CancelBridalGroupInput!) {
  cancelBridalGroup(input: $input) { group { id status } errors { code message field } }
}`;
const CREATE_CONTRACT = `mutation($input: CreateContractInput!) {
  createContract(input: $input) { contract { id } errors { code message field } }
}`;
const UPDATE_CONTRACT = `mutation($id: UUID!, $input: UpdateContractInput!) {
  updateContract(id: $id, input: $input) { contract { id } errors { code message field } }
}`;
const COMANDA = `query($id: UUID!) { comanda(id: $id) { id status total covered owed canClose } }`;
const CLOSE = `mutation($id: UUID!) { closeComanda(id: $id) { comanda { id status } errors { code message } } }`;

/** YYYY-MM-DD de hoje + n dias no fuso de São Paulo (fuso padrão das orgs de teste). */
function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

/** Horário local de São Paulo (UTC-3, sem horário de verão) como instante ISO. */
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

type Err = { code: string; message: string; field: string | null };

describe('Fase 4 - agenda do evento de noivas', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4sched-%'`;
  const eventDay = localDay(60);
  const trialDay = localDay(45);

  beforeAll(async () => {
    w = await createPhase4World('p4sched');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM cash_movements WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM client_credit_movements WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const adm = () => gqlAs(w, w.tokens.admin);

  const newGroup = (companions = 4) =>
    insertBridalGroupRow(w, { companions, eventDate: eventDay });
  type Group = Awaited<ReturnType<typeof newGroup>>;

  /** Noiva: 2 serviços com proA; acompanhantes: 1 serviço cada com proB, em sequência. */
  function eventItems(g: Group, companions = 4) {
    const items = [
      {
        groupMemberId: g.brideMemberId,
        serviceId: w.serviceId,
        professionalId: w.members.proA,
        startsAt: at(eventDay, 9),
        endsAt: at(eventDay, 10),
      },
      {
        groupMemberId: g.brideMemberId,
        serviceId: w.serviceBId,
        professionalId: w.members.proA,
        startsAt: at(eventDay, 10),
        endsAt: at(eventDay, 10, 30),
      },
    ];
    for (let i = 0; i < companions; i++) {
      items.push({
        groupMemberId: g.companionMemberIds[i],
        serviceId: w.serviceBId,
        professionalId: w.members.proB,
        startsAt: at(eventDay, 9 + Math.floor((i * 30) / 60), (i * 30) % 60),
        endsAt: at(eventDay, 9 + Math.floor((i * 30 + 30) / 60), (i * 30 + 30) % 60),
      });
    }
    if (companions > 0) {
      // 7º item: a primeira acompanhante faz um segundo serviço.
      items.push({
        groupMemberId: g.companionMemberIds[0],
        serviceId: w.serviceId,
        professionalId: w.members.proB,
        startsAt: at(eventDay, 11),
        endsAt: at(eventDay, 12),
      });
    }
    return items;
  }

  const schedule = async (input: Record<string, unknown>) =>
    (await att()(SCHEDULE, { input })).data.scheduleBridalEvent as {
      appointmentIds: string[];
      group: { appointmentCount: number; appointments: { covered: boolean; purpose: string }[] } | null;
      errors: Err[];
    };

  const groupApptCount = (groupId: string) =>
    adminPrisma.appointment.count({ where: { bridalGroupId: groupId } });

  it('agenda 7 itens: 7 agendamentos reais, uma comanda por pessoa, finalidade event', async () => {
    const g = await newGroup();
    const r = await schedule({ groupId: g.groupId, items: eventItems(g) });
    expect(r.errors).toEqual([]);
    expect(r.appointmentIds).toHaveLength(7);
    expect(r.group!.appointmentCount).toBe(7);
    const rows = await adminPrisma.appointment.findMany({ where: { bridalGroupId: g.groupId } });
    expect(rows).toHaveLength(7);
    expect(rows.every((a) => a.purpose === 'event' && a.comandaId && !a.contractId)).toBe(true);
    expect(new Set(rows.map((a) => a.comandaId)).size).toBe(5);
    const items = await adminPrisma.comandaItem.findMany({
      where: { appointmentId: { in: r.appointmentIds } },
    });
    expect(items).toHaveLength(7);
    expect(items.every((i) => i.contractId === null)).toBe(true);
  });

  it('contrato criado depois sincroniza a comanda aberta da noiva (preço acordado, comissão no preço cheio)', async () => {
    const g = await newGroup();
    const r = await schedule({ groupId: g.groupId, items: eventItems(g) });
    expect(r.errors).toEqual([]);

    const c = await adm()(CREATE_CONTRACT, {
      input: {
        groupId: g.groupId,
        items: [
          { groupMemberId: g.brideMemberId, serviceId: w.serviceId, unitPrice: '80.00' },
          { groupMemberId: g.brideMemberId, serviceId: w.serviceBId, unitPrice: '40.00' },
        ],
      },
    });
    expect(c.data.createContract.errors).toEqual([]);
    const contractId = c.data.createContract.contract.id as string;

    const brideAppts = await adminPrisma.appointment.findMany({
      where: { bridalGroupId: g.groupId, clientId: g.brideClientId },
    });
    expect(brideAppts).toHaveLength(2);
    expect(brideAppts.every((a) => a.contractId === contractId)).toBe(true);
    const brideItems = await adminPrisma.comandaItem.findMany({
      where: { appointmentId: { in: brideAppts.map((a) => a.id) } },
      orderBy: { listUnitPrice: 'desc' },
    });
    expect(brideItems.map((i) => [i.contractId, i.unitPrice.toString(), i.listUnitPrice.toString()])).toEqual([
      [contractId, '80', '100'],
      [contractId, '40', '50'],
    ]);
    const view = (await att()(COMANDA, { id: brideAppts[0].comandaId })).data.comanda;
    expect(view).toMatchObject({ total: '120.00', covered: '120.00', owed: '0.00' });

    // Acompanhantes fora do contrato seguem sem cobertura.
    const others = await adminPrisma.appointment.count({
      where: { bridalGroupId: g.groupId, clientId: { not: g.brideClientId }, contractId: { not: null } },
    });
    expect(others).toBe(0);
  });

  it('contrato existente antes do agendamento: itens já nascem cobertos', async () => {
    const g = await newGroup();
    const c = await adm()(CREATE_CONTRACT, {
      input: {
        groupId: g.groupId,
        items: [{ groupMemberId: g.brideMemberId, serviceId: w.serviceId, unitPrice: '80.00' }],
      },
    });
    const contractId = c.data.createContract.contract.id as string;
    const r = await schedule({ groupId: g.groupId, items: eventItems(g) });
    expect(r.errors).toEqual([]);
    const rows = await adminPrisma.appointment.findMany({
      where: { bridalGroupId: g.groupId, clientId: g.brideClientId },
      orderBy: { startsAt: 'asc' },
    });
    // Só o serviço A está no contrato; o B da noiva é extra (D-08).
    expect(rows.map((a) => a.contractId)).toEqual([contractId, null]);
    const covered = await adminPrisma.comandaItem.findFirstOrThrow({
      where: { appointmentId: rows[0].id },
    });
    expect(covered.unitPrice.toString()).toBe('80');
    expect(covered.listUnitPrice.toString()).toBe('100');
    const view = (await att()(COMANDA, { id: rows[0].comandaId })).data.comanda;
    expect(view).toMatchObject({ total: '130.00', covered: '80.00', owed: '50.00' });
  });

  it('sinal de acompanhante avulsa gera crédito + caixa; sinal da noiva coberta é recusado', async () => {
    const g = await newGroup();
    const ok = await schedule({
      groupId: g.groupId,
      items: eventItems(g),
      deposits: [{ groupMemberId: g.companionMemberIds[0], amount: '50.00', method: 'pix' }],
    });
    expect(ok.errors).toEqual([]);
    const credit = await adminPrisma.clientCreditMovement.findMany({
      where: { clientId: g.companionClientIds[0] },
    });
    expect(credit.map((m) => [m.kind, m.amount.toString()])).toEqual([['deposit', '50']]);
    const cash = await adminPrisma.cashMovement.findMany({
      where: { clientId: g.companionClientIds[0] },
    });
    expect(cash.map((m) => [m.kind, m.method, m.amount.toString()])).toEqual([
      ['deposit_in', 'pix', '50'],
    ]);

    const g2 = await newGroup();
    const bad = await schedule({
      groupId: g2.groupId,
      items: eventItems(g2),
      deposits: [{ groupMemberId: g2.brideMemberId, amount: '50.00', method: 'pix' }],
    });
    expect(bad.errors[0].code).toBe('DEPOSIT_ONLY_FOR_UNCOVERED');
    expect(await groupApptCount(g2.groupId)).toBe(0);
  });

  it('conflito com outro agendamento devolve SLOT_TAKEN e nada é gravado', async () => {
    const g = await newGroup();
    await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: new Date(at(eventDay, 10)),
        endsAt: new Date(at(eventDay, 11)),
      },
    });
    const before = await groupApptCount(g.groupId);
    const comandasBefore = await adminPrisma.comanda.count({ where: { organizationId: w.orgId } });
    const r = await schedule({ groupId: g.groupId, items: eventItems(g) });
    expect(r.errors[0].code).toBe('SLOT_TAKEN');
    expect(await groupApptCount(g.groupId)).toBe(before);
    expect(await adminPrisma.comanda.count({ where: { organizationId: w.orgId } })).toBe(
      comandasBefore,
    );
  });

  it('dois grupos disputando o mesmo profissional: só um vence', async () => {
    const g1 = await newGroup(0);
    const g2 = await newGroup(0);
    const input = (g: Group) => ({
      groupId: g.groupId,
      items: [
        {
          groupMemberId: g.brideMemberId,
          serviceId: w.serviceId,
          professionalId: w.members.proA,
          startsAt: at(eventDay, 14),
          endsAt: at(eventDay, 15),
        },
      ],
    });
    const [a, b] = await Promise.all([schedule(input(g1)), schedule(input(g2))]);
    const codes = [...a.errors, ...b.errors].map((e) => e.code);
    expect(codes).toEqual(['SLOT_TAKEN']);
    expect(a.errors.length + b.errors.length).toBe(1);
    const total = (await groupApptCount(g1.groupId)) + (await groupApptCount(g2.groupId));
    expect(total).toBe(1);
  });

  it('teste de maquiagem antes do evento vira purpose trial; datas inválidas são recusadas', async () => {
    const g = await newGroup(0);
    const trial = {
      groupMemberId: g.brideMemberId,
      serviceId: w.serviceId,
      professionalId: w.members.proA,
      startsAt: at(trialDay, 10),
      endsAt: at(trialDay, 11),
      purpose: 'trial',
    };
    const ok = await schedule({ groupId: g.groupId, items: [trial] });
    expect(ok.errors).toEqual([]);
    const row = await adminPrisma.appointment.findFirstOrThrow({ where: { bridalGroupId: g.groupId } });
    expect(row.purpose).toBe('trial');

    const sameDay = await schedule({
      groupId: g.groupId,
      items: [{ ...trial, startsAt: at(eventDay, 16), endsAt: at(eventDay, 17) }],
    });
    expect(sameDay.errors[0].code).toBe('TRIAL_NOT_BEFORE_EVENT');

    const otherDay = await schedule({
      groupId: g.groupId,
      items: [
        { ...trial, purpose: 'event', startsAt: at(localDay(61), 10), endsAt: at(localDay(61), 11) },
      ],
    });
    expect(otherDay.errors[0].code).toBe('EVENT_DATE_MISMATCH');
    expect(await groupApptCount(g.groupId)).toBe(1);
  });

  it('D-25: comanda fechada da noiva não muda quando o contrato é editado', async () => {
    const g = await newGroup(0);
    const r = await schedule({ groupId: g.groupId, items: eventItems(g, 0) });
    expect(r.errors).toEqual([]);
    const c = await adm()(CREATE_CONTRACT, {
      input: {
        groupId: g.groupId,
        items: [
          { groupMemberId: g.brideMemberId, serviceId: w.serviceId, unitPrice: '80.00' },
          { groupMemberId: g.brideMemberId, serviceId: w.serviceBId, unitPrice: '40.00' },
        ],
      },
    });
    const contractId = c.data.createContract.contract.id as string;
    const appt = await adminPrisma.appointment.findFirstOrThrow({
      where: { bridalGroupId: g.groupId, serviceId: w.serviceId },
    });
    const closed = await att()(CLOSE, { id: appt.comandaId });
    expect(closed.data.closeComanda.errors).toEqual([]);

    const up = await adm()(UPDATE_CONTRACT, {
      id: contractId,
      input: {
        items: [
          { groupMemberId: g.brideMemberId, serviceId: w.serviceId, unitPrice: '95.00' },
          { groupMemberId: g.brideMemberId, serviceId: w.serviceBId, unitPrice: '45.00' },
        ],
      },
    });
    expect(up.data.updateContract.errors).toEqual([]);
    const items = await adminPrisma.comandaItem.findMany({
      where: { comandaId: appt.comandaId! },
      orderBy: { listUnitPrice: 'desc' },
    });
    expect(items.map((i) => i.unitPrice.toString())).toEqual(['80', '40']);
    expect(items.every((i) => i.contractId === contractId)).toBe(true);
  });

  it('cancelBridalGroup: com contrato vivo exige cancelar o contrato; sem contrato cancela tudo', async () => {
    const withContract = await newGroup(0);
    await insertContractRow(w, {
      groupId: withContract.groupId,
      brideClientId: withContract.brideClientId,
      totalAmount: '100.00',
      depositAmount: '30.00',
    });
    const blocked = await adm()(CANCEL, { input: { id: withContract.groupId, reason: 'Desistência da noiva' } });
    expect(blocked.data.cancelBridalGroup.errors[0].code).toBe('CANCEL_CONTRACT_FIRST');

    const g = await newGroup();
    const r = await schedule({ groupId: g.groupId, items: eventItems(g) });
    expect(r.errors).toEqual([]);

    const denied = await att()(CANCEL, { input: { id: g.groupId, reason: 'Desistência da noiva' } });
    expect(denied.errors).toBeDefined();
    expect(await adminPrisma.appointment.count({ where: { bridalGroupId: g.groupId, status: 'cancelled' } })).toBe(0);

    const short = await adm()(CANCEL, { input: { id: g.groupId, reason: 'x' } });
    expect(short.data.cancelBridalGroup.errors[0].code).toBe('REASON_REQUIRED');

    const done = await adm()(CANCEL, { input: { id: g.groupId, reason: 'Desistência da noiva' } });
    expect(done.data.cancelBridalGroup.errors).toEqual([]);
    expect(done.data.cancelBridalGroup.group.status).toBe('cancelled');
    const rows = await adminPrisma.appointment.findMany({ where: { bridalGroupId: g.groupId } });
    expect(rows).toHaveLength(7);
    expect(rows.every((a) => a.status === 'cancelled' && a.cancelReason === 'Desistência da noiva')).toBe(true);
    const grp = await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: g.groupId } });
    expect(grp.cancelReason).toBe('Desistência da noiva');
  });
});
