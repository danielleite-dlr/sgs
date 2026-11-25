import { adminPrisma } from '../setup';
import {
  createPhase9World,
  destroyPhase9World,
  gqlAs,
  type Phase9World,
} from './phase9-fixtures';

export { gqlAs };

export type Phase10World = Phase9World;

/** Sobras de execução anterior referenciam membros: apagar antes de criar o mundo. */
export async function clearOverrides(w: Pick<Phase10World, 'prefix'>): Promise<void> {
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM member_access_overrides
     WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE '${w.prefix}-%')`,
  );
}

export async function createPhase10World(prefix: string): Promise<Phase10World> {
  await clearOverrides({ prefix });
  return createPhase9World(prefix);
}

export async function destroyPhase10World(w: Phase10World): Promise<void> {
  await clearOverrides(w);
  await destroyPhase9World(w);
}

/** Grava um ajuste direto no banco (adminPrisma, ignora RLS) para preparar cenários. */
export async function setOverrideRow(
  w: Phase10World,
  memberId: string,
  itemId: string,
  enabled: boolean,
  orgId: string = w.orgId,
): Promise<void> {
  await adminPrisma.$executeRawUnsafe(
    `INSERT INTO member_access_overrides (member_id, organization_id, item_id, enabled)
     VALUES ('${memberId}'::uuid, '${orgId}'::uuid, '${itemId}', ${enabled})
     ON CONFLICT (member_id, item_id)
     DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
  );
}
