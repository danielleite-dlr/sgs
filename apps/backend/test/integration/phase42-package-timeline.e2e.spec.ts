import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  GLAM_STEPS,
  gqlAs,
  type Phase4World,
} from './helpers/phase4-fixtures';

const SET = `mutation($input: SetPackageTimelineInput!) {
  setPackageTimeline(input: $input) {
    steps { id displayOrder isExtra name offsetMinutes kind serviceId durationMinutes startsRegistry }
    errors { code message field }
  }
}`;
const GET = `query($id: UUID!) {
  packageTimeline(packageId: $id) { displayOrder name kind serviceId durationMinutes startsRegistry isExtra }
}`;

describe('Fase 04.2 — API de regras de cronograma do pacote', () => {
  let w: Phase4World;

  beforeAll(async () => {
    w = await createPhase4World('p42pkg');
  });

  afterAll(async () => {
    await destroyPhase4World(w);
  });

  const glamInput = () =>
    GLAM_STEPS.map((s) => ({
      isExtra: s.isExtra,
      name: s.name,
      offsetMinutes: s.offsetMinutes,
      kind: s.kind,
      serviceId: s.kind === 'make' ? w.serviceId : s.kind === 'hair' ? w.serviceBId : null,
      durationMinutes: s.durationMinutes,
      startsRegistry: s.startsRegistry,
    }));

  const isForbidden = (res: {
    errors?: { message: string; extensions?: Record<string, unknown> }[];
  }) => {
    const e = res.errors?.[0];
    return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codesOf = (res: { data?: any }): string[] =>
    res.data.setPackageTimeline.errors.map((e: { code: string }) => e.code);

  it('ADMIN grava a regra GLAM e lê na mesma ordem', async () => {
    const res = await gqlAs(w, w.tokens.admin)(SET, {
      input: { packageId: w.bridalPackageId, steps: glamInput() },
    });
    expect(res.errors).toBeUndefined();
    const p = res.data.setPackageTimeline;
    expect(p.errors).toEqual([]);
    expect(p.steps).toHaveLength(8);
    expect(p.steps.map((s: { displayOrder: number }) => s.displayOrder)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);

    const get = await gqlAs(w, w.tokens.admin)(GET, { id: w.bridalPackageId });
    expect(get.data.packageTimeline.map((s: { name: string }) => s.name)).toEqual(
      GLAM_STEPS.map((s) => s.name),
    );
  });

  it('MANAGER grava; ATTENDANT e PROFESSIONAL não gravam; ATTENDANT lê', async () => {
    const input = { packageId: w.bridalPackageId, steps: glamInput() };
    const mgr = await gqlAs(w, w.tokens.manager)(SET, { input });
    expect(mgr.errors).toBeUndefined();
    expect(mgr.data.setPackageTimeline.errors).toEqual([]);

    const att = await gqlAs(w, w.tokens.attendant)(SET, { input });
    expect(isForbidden(att)).toBe(true);
    const pro = await gqlAs(w, w.tokens.proA)(SET, { input });
    expect(isForbidden(pro)).toBe(true);

    const read = await gqlAs(w, w.tokens.attendant)(GET, { id: w.bridalPackageId });
    expect(read.errors).toBeUndefined();
    expect(read.data.packageTimeline).toHaveLength(8);
  });

  it('validações voltam no payload e a regra anterior permanece', async () => {
    const admin = gqlAs(w, w.tokens.admin);

    const noRegistry = glamInput().map((s) => ({ ...s, startsRegistry: false }));
    const r1 = await admin(SET, { input: { packageId: w.bridalPackageId, steps: noRegistry } });
    expect(codesOf(r1)).toContain('TIMELINE_REGISTRY_REQUIRED');

    const foreign = glamInput().map((s) =>
      s.kind === 'make' ? { ...s, serviceId: '00000000-0000-4000-8000-000000000001' } : s,
    );
    const r2 = await admin(SET, { input: { packageId: w.bridalPackageId, steps: foreign } });
    expect(codesOf(r2)).toContain('TIMELINE_SERVICE_NOT_IN_PACKAGE');

    const badOffset = glamInput().map((s, i) => (i === 0 ? { ...s, offsetMinutes: 1441 } : s));
    const r3 = await admin(SET, { input: { packageId: w.bridalPackageId, steps: badOffset } });
    expect(codesOf(r3)).toContain('TIMELINE_OFFSET_INVALID');

    const get = await admin(GET, { id: w.bridalPackageId });
    expect(get.data.packageTimeline).toHaveLength(8);
  });

  it('pacote de outra organização devolve NOT_FOUND (RLS)', async () => {
    const other = await adminPrisma.package.create({
      data: { organizationId: w.otherOrgId, name: `${w.prefix}-pacote-outra-org`, price: '100.00' },
    });
    const res = await gqlAs(w, w.tokens.admin)(SET, {
      input: { packageId: other.id, steps: glamInput() },
    });
    expect(res.data.setPackageTimeline.errors[0].code).toBe('NOT_FOUND');
  });

  it('auditoria registra package.timeline.set', async () => {
    const n = await adminPrisma.auditLog.count({
      where: { action: 'package.timeline.set', entityId: w.bridalPackageId },
    });
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it('lista vazia remove a regra', async () => {
    const res = await gqlAs(w, w.tokens.admin)(SET, {
      input: { packageId: w.bridalPackageId, steps: [] },
    });
    expect(res.data.setPackageTimeline.errors).toEqual([]);
    const get = await gqlAs(w, w.tokens.admin)(GET, { id: w.bridalPackageId });
    expect(get.data.packageTimeline).toEqual([]);
  });
});
