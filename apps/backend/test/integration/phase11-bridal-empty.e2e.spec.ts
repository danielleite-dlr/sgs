import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  GLAM_STEPS,
  insertBridalGroupRow,
  insertPackageTimelineRows,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const PREVIEW = `query($input: BridalTimelineInput!) {
  bridalTimelinePreview(input: $input) {
    preview {
      canConfirm missing
      warnings { code message }
      brideSlots { kind professionalId suggested }
    }
    errors { code message field }
  }
}`;
const PROS = `query($serviceId: UUID!, $bridal: Boolean) {
  professionalsForService(serviceId: $serviceId, bridal: $bridal) { id }
}`;

const year = new Date().getFullYear() + 1;
const eventDay = `${year}-11-08`;

describe('Fase 11 - lista vazia sem profissional marcada para noiva/debutante', () => {
  let w: Phase4World;
  let groupId: string;

  beforeAll(async () => {
    w = await createPhase4World('p11emp', { bridalPros: false });
    await adminPrisma.package.update({
      where: { id: w.bridalPackageId },
      data: { name: 'Glam' },
    });
    await insertPackageTimelineRows(w, w.bridalPackageId, GLAM_STEPS, {
      makeServiceId: w.serviceId,
      hairServiceId: w.serviceBId,
    });
    const g = await insertBridalGroupRow(w, { companions: 0, eventDate: eventDay });
    groupId = g.groupId;
  });
  afterAll(async () => {
    await destroyPhase4World(w);
    await deletePhase4Rows(`SELECT id FROM organizations WHERE legal_name LIKE 'p11emp-%'`);
  });

  it('simulação: make e penteado sem profissional, aviso NO_BRIDAL_PROFESSIONAL uma vez', async () => {
    const res = await gqlAs(w, w.tokens.attendant)(PREVIEW, {
      input: { groupId, packageId: w.bridalPackageId, departureTime: '17:00' },
    });
    const p = res.data.bridalTimelinePreview.preview;
    expect(res.data.bridalTimelinePreview.errors).toEqual([]);
    for (const s of p.brideSlots) {
      expect(s.professionalId).toBeNull();
      expect(s.suggested).toBe(false);
    }
    expect(
      p.warnings.filter((x: { code: string }) => x.code === 'NO_BRIDAL_PROFESSIONAL'),
    ).toHaveLength(1);
    expect(p.canConfirm).toBe(false);
  });

  it('professionalsForService com bridal:true devolve lista vazia, sem fallback (D-04)', async () => {
    const res = await gqlAs(w, w.tokens.attendant)(PROS, {
      serviceId: w.serviceId,
      bridal: true,
    });
    expect(res.errors).toBeUndefined();
    expect(res.data.professionalsForService).toEqual([]);
  });
});
