import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';

const VISIT = `mutation($i: CreateVisitInput!) {
  createVisit(input: $i) {
    comandaId
    appointments { id comandaId comandaCode comandaStatus serviceVariantId depositAmount }
    errors { code message field }
  }
}`;
const CREATE = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id comandaId comandaCode } errors { code } }
}`;

describe('Phase 3 - createVisit (agenda + comanda)', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p3visit');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(`SELECT id FROM organizations WHERE legal_name LIKE 'p3visit-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const slot = (h1: string, h2: string, day = '10') => ({
    startsAt: `2030-06-${day}T${h1}:00Z`,
    endsAt: `2030-06-${day}T${h2}:00Z`,
  });
  const itemA = (extra: Record<string, unknown> = {}) => ({
    serviceId: w.serviceId,
    professionalId: w.members.proA,
    ...slot('10:00', '11:00'),
    ...extra,
  });
  const itemB = (extra: Record<string, unknown> = {}) => ({
    serviceId: w.serviceBId,
    professionalId: w.members.proB,
    ...slot('10:00', '10:30'),
    ...extra,
  });
  const visit = async (input: Record<string, unknown>) =>
    (await att()(VISIT, { i: { clientId: w.clientId, ...input } })).data.createVisit;

  const counts = async () => {
    const q = async (t: string) =>
      Number(
        (
          await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*) AS n FROM ${t} WHERE organization_id = '${w.orgId}'::uuid`,
          )
        )[0].n,
      );
    return [
      await q('appointments'),
      await q('comandas'),
      await q('comanda_items'),
      await q('client_credit_movements'),
      await q('cash_movements'),
    ];
  };

  it('2 serviços em 2 raias -> 2 appointments, 1 comanda aberta, 2 itens', async () => {
    const r = await visit({ items: [itemA(), itemB()] });
    expect(r.errors).toEqual([]);
    expect(r.appointments).toHaveLength(2);
    const comanda = await adminPrisma.comanda.findUniqueOrThrow({
      where: { id: r.comandaId },
      include: { items: true },
    });
    expect(comanda.status).toBe('open');
    expect(comanda.code).toMatch(/^C-/);
    expect(comanda.total.toFixed(2)).toBe('150.00');
    expect(comanda.items).toHaveLength(2);
    const apptIds = r.appointments.map((a: { id: string }) => a.id).sort();
    expect(comanda.items.map((i) => i.appointmentId).sort()).toEqual(apptIds);
    expect(r.appointments.every((a: { comandaId: string }) => a.comandaId === r.comandaId)).toBe(true);
    expect(r.appointments[0].comandaCode).toBe(comanda.code);
  });

  it('variante: item e agendamento usam o preço da variante', async () => {
    const r = await visit({ items: [itemA({ serviceVariantId: w.variantId })] });
    expect(r.errors).toEqual([]);
    expect(r.appointments[0].serviceVariantId).toBe(w.variantId);
    const item = await adminPrisma.comandaItem.findFirstOrThrow({ where: { comandaId: r.comandaId } });
    expect(item.listUnitPrice.toFixed(2)).toBe('120.00');
    expect(item.unitPrice.toFixed(2)).toBe('120.00');
  });

  it('pacote: itens rateados 90/45 com preço cheio 100/50 e appointmentId', async () => {
    const r = await visit({ packageId: w.packageId, items: [itemA(), itemB()] });
    expect(r.errors).toEqual([]);
    const comanda = await adminPrisma.comanda.findUniqueOrThrow({
      where: { id: r.comandaId },
      include: { items: true },
    });
    expect(comanda.total.toFixed(2)).toBe('135.00');
    const bySvc = Object.fromEntries(comanda.items.map((i) => [i.serviceId, i]));
    expect(bySvc[w.serviceId].unitPrice.toFixed(2)).toBe('90.00');
    expect(bySvc[w.serviceId].listUnitPrice.toFixed(2)).toBe('100.00');
    expect(bySvc[w.serviceBId].unitPrice.toFixed(2)).toBe('45.00');
    expect(bySvc[w.serviceBId].listUnitPrice.toFixed(2)).toBe('50.00');
    expect(comanda.items.every((i) => i.appointmentId)).toBe(true);
  });

  it('pacote: serviço fora do pacote e pacote incompleto', async () => {
    const other = await adminPrisma.service.create({
      data: {
        organizationId: w.orgId,
        categoryId: w.childCategoryId,
        name: 'p3visit-extra',
        basePrice: '10.00',
        defaultDurationMinutes: 15,
      },
    });
    const before = await counts();
    const r1 = await visit({
      packageId: w.packageId,
      items: [itemA(), itemB(), { serviceId: other.id, professionalId: w.members.proA, ...slot('12:00', '12:15') }],
    });
    expect(r1.errors[0].code).toBe('SERVICE_NOT_IN_PACKAGE');
    const r2 = await visit({ packageId: w.packageId, items: [itemA()] });
    expect(r2.errors[0].code).toBe('MISSING_ASSIGNMENT');
    expect(await counts()).toEqual(before);
    await adminPrisma.service.delete({ where: { id: other.id } });
  });

  it('conflito no 2º item desfaz tudo (inclusive sinal)', async () => {
    await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proB,
        clientId: w.clientId,
        serviceId: w.serviceBId,
        ...{ startsAt: new Date('2030-06-10T10:15:00Z'), endsAt: new Date('2030-06-10T10:45:00Z') },
      },
    });
    const before = await counts();
    const r = await visit({
      items: [itemA(), itemB()],
      deposit: { amount: '50.00', method: 'pix' },
    });
    expect(r.errors[0].code).toBe('SLOT_TAKEN');
    expect(r.appointments).toEqual([]);
    expect(await counts()).toEqual(before);
  });

  it('dois itens do mesmo profissional sobrepostos -> SLOT_TAKEN', async () => {
    const before = await counts();
    const r = await visit({
      items: [itemA(), itemB({ professionalId: w.members.proA })],
    });
    expect(r.errors[0].code).toBe('SLOT_TAKEN');
    expect(await counts()).toEqual(before);
  });

  it('createAppointment também abre comanda com 1 item', async () => {
    const res = await att()(CREATE, {
      i: {
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        ...slot('14:00', '15:00'),
      },
    });
    const p = res.data.createAppointment;
    expect(p.errors).toEqual([]);
    expect(p.appointment.comandaId).toBeTruthy();
    expect(p.appointment.comandaCode).toMatch(/^C-/);
    const items = await adminPrisma.comandaItem.findMany({
      where: { comandaId: p.appointment.comandaId },
    });
    expect(items).toHaveLength(1);
  });

  it('items vazio e mais de 10 itens', async () => {
    expect((await visit({ items: [] })).errors[0].code).toBe('ITEMS_REQUIRED');
    const many = Array.from({ length: 11 }, (_, i) =>
      itemA({ ...slot(`${String(i).padStart(2, '0')}:00`, `${String(i).padStart(2, '0')}:30`, '11') }),
    );
    expect((await visit({ items: many })).errors[0].code).toBe('TOO_MANY_ITEMS');
  });

  it('variante de outro serviço -> VARIANT_NOT_FOUND', async () => {
    const r = await visit({ items: [itemB({ serviceVariantId: w.variantId })] });
    expect(r.errors[0].code).toBe('VARIANT_NOT_FOUND');
  });
});
