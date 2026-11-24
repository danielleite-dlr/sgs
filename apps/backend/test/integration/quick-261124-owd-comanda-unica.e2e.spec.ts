import { adminPrisma } from './setup';
import { createPhase3World, destroyPhase3World, gqlAs, type Phase3World } from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';

// quick 261124-owd: visita nova da mesma cliente no mesmo dia local entra na comanda aberta.

const VISIT = `mutation($i: CreateVisitInput!) {
  createVisit(input: $i) { comandaId appointments { id } errors { code message field } }
}`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

describe('quick 261124-owd - comanda única por cliente no dia', () => {
  let w: Phase3World;
  const day = localDay(70);
  const nextDay = localDay(71);

  beforeAll(async () => {
    w = await createPhase3World('q24owd');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(`SELECT id FROM organizations WHERE legal_name LIKE 'q24owd-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const visit = async (
    d: string,
    hh: number,
    opts: { serviceId?: string; professionalId?: string; deposit?: { amount: string; method: string } } = {},
  ) => {
    const r = await gqlAs(w, w.tokens.attendant)(VISIT, {
      i: {
        clientId: w.clientId,
        items: [
          {
            serviceId: opts.serviceId ?? w.serviceId,
            professionalId: opts.professionalId ?? w.members.proA,
            startsAt: at(d, hh),
            endsAt: at(d, hh + 1),
          },
        ],
        ...(opts.deposit ? { deposit: opts.deposit } : {}),
      },
    });
    const p = r.data.createVisit as { comandaId: string; errors: unknown[] };
    expect(p.errors).toEqual([]);
    return p.comandaId;
  };
  const comandaCount = async () =>
    adminPrisma.comanda.count({ where: { organizationId: w.orgId, clientId: w.clientId } });

  it('mesmo dia: junta na comanda aberta, soma itens e total', async () => {
    const c1 = await visit(day, 10);
    const c2 = await visit(day, 14, { serviceId: w.serviceBId, professionalId: w.members.proB });
    expect(c2).toBe(c1);
    expect(await comandaCount()).toBe(1);
    const items = await adminPrisma.comandaItem.findMany({ where: { comandaId: c1 } });
    expect(items).toHaveLength(2);
    const appts = await adminPrisma.appointment.findMany({ where: { comandaId: c1 } });
    expect(appts).toHaveLength(2);
    const c = await adminPrisma.comanda.findUniqueOrThrow({ where: { id: c1 } });
    expect(c.total.toString()).toBe('150');
  });

  it('outro dia: abre comanda nova', async () => {
    const c1 = await visit(day, 10);
    const c2 = await visit(nextDay, 10);
    expect(c2).not.toBe(c1);
    expect(await comandaCount()).toBe(2);
  });

  it('comanda fechada não é reaproveitada', async () => {
    const c1 = await visit(day, 10);
    await adminPrisma.comanda.update({
      where: { id: c1 },
      data: { status: 'closed', closedAt: new Date(), closedBy: w.members.admin },
    });
    const c2 = await visit(day, 14, { professionalId: w.members.proB });
    expect(c2).not.toBe(c1);
  });

  it('comanda cujo único agendamento está cancelado não é reaproveitada', async () => {
    const c1 = await visit(day, 10);
    await adminPrisma.appointment.updateMany({
      where: { comandaId: c1 },
      data: { status: 'cancelled' },
    });
    const c2 = await visit(day, 14, { professionalId: w.members.proB });
    expect(c2).not.toBe(c1);
  });

  it('sinal da segunda visita vai para a comanda reaproveitada', async () => {
    const c1 = await visit(day, 10);
    const c2 = await visit(day, 14, {
      professionalId: w.members.proB,
      deposit: { amount: '30.00', method: 'pix' },
    });
    expect(c2).toBe(c1);
    const credit = await adminPrisma.clientCreditMovement.findMany({
      where: { organizationId: w.orgId, clientId: w.clientId },
    });
    expect(credit.length).toBeGreaterThan(0);
    expect(credit.every((m) => m.comandaId === c1)).toBe(true);
    const cash = await adminPrisma.cashMovement.findMany({ where: { organizationId: w.orgId } });
    expect(cash.length).toBeGreaterThan(0);
    expect(cash.every((m) => m.comandaId === c1)).toBe(true);
  });
});
