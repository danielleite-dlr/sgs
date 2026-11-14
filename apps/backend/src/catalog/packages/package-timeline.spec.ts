import {
  PackageTimelineStepInput,
  validatePackageTimelineSteps,
} from './package-timeline';

const MAKE = 'svc-make';
const HAIR = 'svc-hair';
const SERVICES = new Set([MAKE, HAIR]);

const step = (over: Partial<PackageTimelineStepInput> = {}): PackageTimelineStepInput => ({
  isExtra: false,
  name: 'Etapa',
  offsetMinutes: 120,
  ...over,
});

const glam = (): PackageTimelineStepInput[] => [
  step({ name: 'Chegada da equipe', offsetMinutes: 300 }),
  step({ name: 'Make da noiva', offsetMinutes: 270, kind: 'make', serviceId: MAKE, durationMinutes: 90 }),
  step({ name: 'Penteado', offsetMinutes: 180, kind: 'hair', serviceId: HAIR, durationMinutes: 90 }),
  step({ name: 'Fotos', offsetMinutes: 90, startsRegistry: true }),
  step({ name: 'Saída', offsetMinutes: 0 }),
  step({ name: 'Taxa extra', offsetMinutes: 60, isExtra: true }),
];

const codes = (s: PackageTimelineStepInput[]) =>
  validatePackageTimelineSteps(s, SERVICES).map((e) => e.code);

describe('validatePackageTimelineSteps', () => {
  it('lista vazia é válida (remove a regra)', () => {
    expect(codes([])).toEqual([]);
  });

  it('GLAM completo é válido', () => {
    expect(codes(glam())).toEqual([]);
  });

  it('exige uma etapa que inicia o registro', () => {
    const s = glam();
    s[3].startsRegistry = false;
    expect(codes(s)).toContain('TIMELINE_REGISTRY_REQUIRED');
  });

  it('recusa dois inícios de registro', () => {
    const s = glam();
    s[0].startsRegistry = true;
    expect(codes(s)).toContain('TIMELINE_REGISTRY_DUPLICATE');
  });

  it('recusa registro em extra', () => {
    const s = glam();
    s[5].startsRegistry = true;
    expect(codes(s)).toContain('TIMELINE_REGISTRY_ON_EXTRA');
  });

  it('recusa dois make', () => {
    const s = glam();
    s[2].kind = 'make';
    expect(codes(s)).toContain('TIMELINE_KIND_DUPLICATE');
  });

  it('recusa kind em extra', () => {
    const s = glam();
    s[5].kind = 'hair';
    expect(codes(s)).toContain('TIMELINE_KIND_ON_EXTRA');
  });

  it('recusa kind inválido', () => {
    const s = glam();
    s[1].kind = 'nail';
    expect(codes(s)).toContain('TIMELINE_KIND_INVALID');
  });

  it('recusa kind sem serviceId', () => {
    const s = glam();
    s[1].serviceId = null;
    expect(codes(s)).toContain('TIMELINE_SERVICE_NOT_IN_PACKAGE');
  });

  it('recusa serviceId fora do pacote', () => {
    const s = glam();
    s[1].serviceId = 'outro';
    expect(codes(s)).toContain('TIMELINE_SERVICE_NOT_IN_PACKAGE');
  });

  it.each([null, 4, 601])('recusa duração %s em etapa make/penteado', (d) => {
    const s = glam();
    s[1].durationMinutes = d;
    expect(codes(s)).toContain('TIMELINE_DURATION_INVALID');
  });

  it('ignora duração em etapa sem kind', () => {
    const s = glam();
    s[0].durationMinutes = 1000;
    expect(codes(s)).toEqual([]);
  });

  it.each([-1, 1441, 10.5])('recusa offset %s', (o) => {
    const s = glam();
    s[0].offsetMinutes = o;
    expect(codes(s)).toContain('TIMELINE_OFFSET_INVALID');
  });

  it.each(['', '   ', 'x'.repeat(121)])('recusa nome inválido', (n) => {
    const s = glam();
    s[0].name = n;
    expect(codes(s)).toContain('TIMELINE_STEP_NAME');
  });

  it('recusa mais de 30 itens', () => {
    const s = Array.from({ length: 31 }, () => step());
    expect(codes(s)).toContain('TIMELINE_TOO_MANY_STEPS');
  });

  it('recusa lista só com extras', () => {
    expect(codes([step({ isExtra: true })])).toContain('TIMELINE_STEP_REQUIRED');
  });
});
