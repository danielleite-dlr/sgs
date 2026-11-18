import request from 'supertest';
import { adminPrisma } from '../setup';
import { deletePhase9Rows } from './phase9-cleanup';
import { createPhase4World, destroyPhase4World, gqlAs, type Phase4World } from './phase4-fixtures';

export { gqlAs };

export interface Phase9World extends Phase4World {
  /** segunda atendente (ATTENDANT, isProfessional false) da mesma org */
  attendantB: { memberId: string; token: string };
  /** pacote "spa-dos-15": price "900.00", sinal 30% */
  debutantePackageId: string;
}

const orgFilter = (prefix: string) =>
  `SELECT id FROM organizations WHERE legal_name LIKE '${prefix}-%'`;

export type StageKey = 'Novo' | 'Contato' | 'Proposta' | 'Negociação' | 'won' | 'lost';

async function deleteStages(prefix: string): Promise<void> {
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM commercial_stages WHERE organization_id IN (${orgFilter(prefix)})`,
  );
}

/** Mesmo INSERT do backfill da migração: orgs criadas depois dela não têm etapas. */
async function ensureDefaultStages(orgIds: string[]): Promise<void> {
  for (const orgId of orgIds) {
    await adminPrisma.$executeRawUnsafe(
      `INSERT INTO commercial_stages (organization_id, name, color, position, sla_days, kind, is_system)
       SELECT o.id, s.name, s.color, s.position, s.sla_days, s.kind, s.is_system
       FROM organizations o
       CROSS JOIN (VALUES
         ('Novo', '#64748B', 0, 1, 'open', false),
         ('Contato', '#3B82F6', 1, 3, 'open', false),
         ('Proposta', '#8B5CF6', 2, 3, 'open', false),
         ('Negociação', '#F59E0B', 3, 2, 'open', false),
         ('Ganho', '#16A34A', 100, NULL, 'won', true),
         ('Perdido', '#DC2626', 101, NULL, 'lost', true)
       ) AS s(name, color, position, sla_days, kind, is_system)
       WHERE o.id = '${orgId}'::uuid
         AND NOT EXISTS (SELECT 1 FROM commercial_stages cs WHERE cs.organization_id = o.id)`,
    );
  }
}

/** Mundo da Fase 4 + atendente B + pacote de debutante + etapas padrão nas duas orgs. */
export async function createPhase9World(prefix: string): Promise<Phase9World> {
  // sobras de uma execução anterior referenciam membros/clientes/contratos
  await deletePhase9Rows(orgFilter(prefix));
  await deleteStages(prefix);
  const w = await createPhase4World(prefix);

  const stamp = Date.now();
  const role = await adminPrisma.role.findFirstOrThrow({
    where: { name: 'ATTENDANT', isSystem: true },
  });
  const argon2 = await import('argon2');
  const pwHash = await argon2.hash('password1234', { type: argon2.argon2id });
  const user = await adminPrisma.user.create({
    data: {
      email: `${prefix}-attendant-b-${stamp}@t.com`,
      fullName: `${prefix} attendant-b`,
      passwordHash: pwHash,
      emailVerifiedAt: new Date(),
    },
  });
  const member = await adminPrisma.member.create({
    data: {
      organizationId: w.orgId,
      userId: user.id,
      roleId: role.id,
      displayName: `${prefix}-attendant-b`,
      isProfessional: false,
    },
  });
  const login = await request(w.app.getHttpServer())
    .post('/graphql')
    .set('Content-Type', 'application/json')
    .send({
      query: `mutation($i: LoginInput!) { login(input: $i) { accessToken } }`,
      variables: { i: { email: user.email, password: 'password1234' } },
    });
  const token = login.body?.data?.login?.accessToken as string;
  if (!token) throw new Error(`login da atendente B falhou: ${JSON.stringify(login.body)}`);

  const debutantePackageId = (
    await adminPrisma.package.create({
      data: {
        organizationId: w.orgId,
        name: `${prefix}-spa-dos-15`,
        price: '900.00',
        depositKind: 'percent',
        depositValue: '30.00',
        services: { create: [{ serviceId: w.serviceId, quantity: 1, displayOrder: 0 }] },
      },
    })
  ).id;

  await ensureDefaultStages([w.orgId, w.otherOrgId]);

  return { ...w, attendantB: { memberId: member.id, token }, debutantePackageId };
}

export async function destroyPhase9World(w: Phase9World): Promise<void> {
  await deletePhase9Rows(orgFilter(w.prefix));
  await deleteStages(w.prefix);
  await destroyPhase4World(w);
}

/** id da etapa por nome ('Novo'...) ou por kind ('won' | 'lost'). */
export async function stageIdOf(orgId: string, key: StageKey): Promise<string> {
  const where =
    key === 'won' || key === 'lost'
      ? { organizationId: orgId, kind: key }
      : { organizationId: orgId, name: key };
  return (await adminPrisma.commercialStage.findFirstOrThrow({ where })).id;
}

export interface InsertLeadOpts {
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  createdBy?: string | null;
  clientId?: string | null;
  source?: string;
  orgId?: string;
}

let seq = 0;

/** Insere um lead direto no banco; devolve o id. */
export async function insertLeadRow(w: Phase9World, opts: InsertLeadOpts = {}): Promise<string> {
  const n = ++seq;
  const rand8 = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const phone = opts.phone === undefined ? `(11) 9${rand8}` : opts.phone; // null só vale com e-mail
  const email =
    opts.email === undefined && phone === null ? `${w.prefix}-lead-${n}@t.com` : opts.email;
  const lead = await adminPrisma.commercialLead.create({
    data: {
      organizationId: opts.orgId ?? w.orgId,
      fullName: opts.fullName ?? `${w.prefix}-lead-${n}`,
      phone,
      phoneDigits: phone ? phone.replace(/\D/g, '') : null,
      email: email ?? null,
      createdBy: opts.createdBy ?? null,
      clientId: opts.clientId ?? null,
      source: opts.source ?? 'manual',
    },
  });
  return lead.id;
}

export interface InsertDealOpts {
  leadId: string;
  stageName?: StageKey;
  kind?: 'noiva' | 'debutante';
  /** null = sem responsável */
  assignee?: string | null;
  packageId?: string | null;
  eventDate?: string;
  status?: 'open' | 'won' | 'lost';
  beneficiaryName?: string | null;
  lastInteractionAt?: Date | null;
  stageEnteredAt?: Date;
  orgId?: string;
}

/** Insere um negócio direto no banco; devolve o id. Padrões: noiva, etapa Novo, pacote de noiva. */
export async function insertDealRow(w: Phase9World, opts: InsertDealOpts): Promise<string> {
  const orgId = opts.orgId ?? w.orgId;
  const status = opts.status ?? 'open';
  const stage: StageKey =
    opts.stageName ?? (status === 'won' ? 'won' : status === 'lost' ? 'lost' : 'Novo');
  const packageId = opts.packageId === undefined ? w.bridalPackageId : opts.packageId;
  const deal = await adminPrisma.commercialDeal.create({
    data: {
      organizationId: orgId,
      leadId: opts.leadId,
      stageId: await stageIdOf(orgId, stage),
      status,
      kind: opts.kind ?? 'noiva',
      assigneeMemberId: opts.assignee ?? null,
      packageId,
      eventDate: opts.eventDate ? new Date(`${opts.eventDate}T00:00:00.000Z`) : null,
      beneficiaryName: opts.beneficiaryName ?? null,
      lastInteractionAt: opts.lastInteractionAt ?? null,
      ...(opts.stageEnteredAt ? { stageEnteredAt: opts.stageEnteredAt } : {}),
      ...(status === 'lost' ? { lostReasonCode: 'other', closedAt: new Date() } : {}),
      ...(status === 'won' ? { closedAt: new Date() } : {}),
    },
  });
  return deal.id;
}
