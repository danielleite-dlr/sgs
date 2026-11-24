import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

// quick 261124-mkp: atendimento criado pela agenda para pessoa do grupo, no dia do evento,
// entra no grupo (filtro da noiva e aba Agenda do grupo); fora do dia segue social.

const CREATE_VISIT = `mutation($i: CreateVisitInput!) {
  createVisit(input: $i) { appointments { id } errors { code message field } }
}`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

describe('quick 261124-mkp - agendamento pela agenda entra no grupo da noiva', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'q24mkp-%'`;
  const eventDay = localDay(60);
  const otherDay = localDay(61);

  beforeAll(async () => {
    w = await createPhase4World('q24mkp');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
    for (const t of ['cash_movements', 'client_credit_movements', 'appointments']) {
      await adminPrisma.$executeRawUnsafe(
        `DELETE FROM ${t} WHERE organization_id = '${w.orgId}'::uuid`,
      );
    }
  });

  const visit = async (clientId: string, day: string) => {
    const r = await gqlAs(w, w.tokens.attendant)(CREATE_VISIT, {
      i: {
        clientId,
        items: [
          {
            serviceId: w.serviceId,
            professionalId: w.members.proA,
            startsAt: at(day, 10),
            endsAt: at(day, 11, 30),
          },
        ],
      },
    });
    const p = r.data.createVisit as { appointments: { id: string }[]; errors: unknown[] };
    expect(p.errors).toEqual([]);
    return adminPrisma.appointment.findUniqueOrThrow({ where: { id: p.appointments[0].id } });
  };

  it('acompanhante no dia do evento: entra no grupo como evento', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    const a = await visit(g.companionClientIds[0], eventDay);
    expect(a.bridalGroupId).toBe(g.groupId);
    expect(a.purpose).toBe('event');
  });

  it('mesma pessoa em outro dia: segue atendimento social', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    const a = await visit(g.companionClientIds[0], otherDay);
    expect(a.bridalGroupId).toBeNull();
    expect(a.purpose).toBeNull();
  });

  it('grupo cancelado: não liga', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    await adminPrisma.bridalGroup.update({ where: { id: g.groupId }, data: { status: 'cancelled' } });
    const a = await visit(g.companionClientIds[0], eventDay);
    expect(a.bridalGroupId).toBeNull();
  });
});
