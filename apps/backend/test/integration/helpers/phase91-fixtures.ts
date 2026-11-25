import { adminPrisma } from '../setup';
import {
  createPhase4World,
  destroyPhase4World,
  insertBridalGroupRow,
  type Phase4World,
} from './phase4-fixtures';

export interface Phase91World extends Phase4World {
  /** Duas profissionais com is_bridal_assistant = true (sem token de login). */
  assistants: { a: string; b: string };
  /** Profissional que NÃO é assistente (members.proA). */
  nonAssistantProId: string;
}

/** Mundo da Fase 4 + 2 assistentes + pacote de noiva marcado com includes_bridal_assistant. */
export async function createPhase91World(prefix: string): Promise<Phase91World> {
  const w = await createPhase4World(prefix);
  const stamp = Date.now();
  const roleId = (
    await adminPrisma.member.findUniqueOrThrow({
      where: { id: w.members.proA },
      select: { roleId: true },
    })
  ).roleId;
  const mk = async (tag: 'a' | 'b'): Promise<string> => {
    const user = await adminPrisma.user.create({
      data: {
        email: `${prefix}-assist-${tag}-${stamp}@teste.com`,
        fullName: `${prefix} Assistente ${tag.toUpperCase()}`,
        passwordHash: 'x',
        emailVerifiedAt: new Date(),
      },
    });
    const member = await adminPrisma.member.create({
      data: {
        organizationId: w.orgId,
        userId: user.id,
        roleId,
        displayName: `${prefix} Assistente ${tag.toUpperCase()}`,
        isProfessional: true,
      },
    });
    await adminPrisma.$executeRawUnsafe(
      `UPDATE members SET is_bridal_assistant = true WHERE id = '${member.id}'::uuid`,
    );
    return member.id;
  };
  const a = await mk('a');
  const b = await mk('b');
  await adminPrisma.$executeRawUnsafe(
    `UPDATE packages SET includes_bridal_assistant = true WHERE id = '${w.bridalPackageId}'::uuid`,
  );
  return { ...w, assistants: { a, b }, nonAssistantProId: w.members.proA };
}

export interface InsertStudioBrideGroupOpts {
  eventDate: string;
  locationKind?: 'studio' | 'external';
  eventKind?: 'noiva' | 'debutante';
  packageId?: string | null;
  name?: string;
}

/** Grupo (noiva) no estúdio com o pacote do mundo por padrão; devolve ids do grupo e da noiva. */
export async function insertStudioBrideGroup(
  w: Phase91World,
  opts: InsertStudioBrideGroupOpts,
): Promise<{ groupId: string; brideMemberId: string }> {
  const g = await insertBridalGroupRow(w, {
    eventDate: opts.eventDate,
    locationKind: opts.locationKind ?? 'studio',
    eventKind: opts.eventKind ?? 'noiva',
  });
  const packageId = opts.packageId === undefined ? w.bridalPackageId : opts.packageId;
  await adminPrisma.bridalGroup.update({
    where: { id: g.groupId },
    data: { packageId, ...(opts.name ? { name: opts.name } : {}) },
  });
  return { groupId: g.groupId, brideMemberId: g.brideMemberId };
}

export async function destroyPhase91World(w: Phase91World): Promise<void> {
  await adminPrisma.$executeRawUnsafe(
    `UPDATE bridal_groups SET assistant_member_id = NULL, assistant_daily_rate = NULL, assistant_linked_at = NULL
      WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE '${w.prefix}-%')`,
  );
  await destroyPhase4World(w);
}
