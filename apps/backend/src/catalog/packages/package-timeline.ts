import type { TenantPrismaClient } from '../../database/types';
import type {
  TimelineKind,
  TimelineRuleStep,
} from '../../bridal/timeline/timeline-domain';

export interface PackageTimelineStepInput {
  isExtra: boolean;
  name: string;
  offsetMinutes: number;
  kind?: string | null;
  serviceId?: string | null;
  durationMinutes?: number | null;
  startsRegistry?: boolean | null;
}

export interface PackageTimelineError {
  code: string;
  message: string;
  field: string;
}

const MAX_STEPS = 30;

/**
 * Validação pura das regras de cronograma de um pacote (D-01).
 * Devolve TODOS os erros encontrados.
 */
export function validatePackageTimelineSteps(
  steps: PackageTimelineStepInput[],
  packageServiceIds: ReadonlySet<string>,
): PackageTimelineError[] {
  const errors: PackageTimelineError[] = [];
  const add = (code: string, message: string, field: string) =>
    errors.push({ code, message, field });

  if (steps.length === 0) return errors;

  if (steps.length > MAX_STEPS) {
    add('TIMELINE_TOO_MANY_STEPS', 'Máximo de 30 itens no cronograma.', 'steps');
  }

  let registryCount = 0;
  let nonExtra = 0;
  const seenKinds = new Set<string>();

  steps.forEach((s, i) => {
    const f = (k: string) => `steps.${i}.${k}`;
    const name = typeof s.name === 'string' ? s.name.trim() : '';
    if (name.length === 0 || name.length > 120) {
      add('TIMELINE_STEP_NAME', 'Dê um nome à etapa (até 120 caracteres).', f('name'));
    }
    if (
      !Number.isInteger(s.offsetMinutes) ||
      s.offsetMinutes < 0 ||
      s.offsetMinutes > 1440
    ) {
      add(
        'TIMELINE_OFFSET_INVALID',
        'O horário da etapa deve ficar entre 0 e 1440 minutos antes da saída.',
        f('offsetMinutes'),
      );
    }
    if (!s.isExtra) nonExtra += 1;

    if (s.startsRegistry) {
      if (s.isExtra) {
        add(
          'TIMELINE_REGISTRY_ON_EXTRA',
          'O início do registro deve ser uma etapa, não um extra.',
          f('startsRegistry'),
        );
      } else {
        registryCount += 1;
        if (registryCount === 2) {
          add('TIMELINE_REGISTRY_DUPLICATE', 'Só uma etapa pode iniciar o registro.', f('startsRegistry'));
        }
      }
    }

    if (s.kind != null) {
      if (s.isExtra) {
        add('TIMELINE_KIND_ON_EXTRA', 'Extras não podem ser make ou penteado.', f('kind'));
      } else if (s.kind !== 'make' && s.kind !== 'hair') {
        add('TIMELINE_KIND_INVALID', 'Tipo de etapa inválido.', f('kind'));
      } else {
        if (seenKinds.has(s.kind)) {
          add(
            'TIMELINE_KIND_DUPLICATE',
            'Só pode haver uma etapa de make e uma de penteado.',
            f('kind'),
          );
        }
        seenKinds.add(s.kind);
        if (!s.serviceId || !packageServiceIds.has(s.serviceId)) {
          add(
            'TIMELINE_SERVICE_NOT_IN_PACKAGE',
            'Escolha um serviço do pacote para a etapa de make/penteado.',
            f('serviceId'),
          );
        }
        const d = s.durationMinutes;
        if (d == null || !Number.isInteger(d) || d < 5 || d > 600) {
          add(
            'TIMELINE_DURATION_INVALID',
            'A duração do atendimento da noiva deve ficar entre 5 e 600 minutos.',
            f('durationMinutes'),
          );
        }
      }
    }
  });

  if (nonExtra === 0) {
    add('TIMELINE_STEP_REQUIRED', 'Inclua ao menos uma etapa (além dos extras).', 'steps');
  }
  if (registryCount === 0) {
    add(
      'TIMELINE_REGISTRY_REQUIRED',
      'Marque a etapa que inicia o registro (fotos ou making of).',
      'steps',
    );
  }

  return errors;
}

/** Lê as regras do pacote já no formato do domínio do cronograma. */
export async function loadPackageTimelineTx(
  tx: TenantPrismaClient,
  packageId: string,
): Promise<TimelineRuleStep[]> {
  const rows = await tx.packageTimelineStep.findMany({
    where: { packageId },
    orderBy: { displayOrder: 'asc' },
  });
  return rows.map((r) => ({
    name: r.name,
    offsetMinutes: r.offsetMinutes,
    isExtra: r.isExtra,
    kind: (r.kind as TimelineKind | null) ?? null,
    startsRegistry: r.startsRegistry,
    displayOrder: r.displayOrder,
    durationMinutes: r.durationMinutes,
    serviceId: r.serviceId,
  }));
}
