import { Injectable } from '@nestjs/common';
import { recordAudit } from '../../common/audit-log';
import { TenantContextService } from '../../database/tenant-context.service';
import {
  PackageTimelineError,
  PackageTimelineStepInput,
  validatePackageTimelineSteps,
} from './package-timeline';

export interface SetPackageTimelineInput {
  packageId: string;
  steps: PackageTimelineStepInput[];
}

const STEP_SELECT = {
  id: true,
  displayOrder: true,
  isExtra: true,
  name: true,
  offsetMinutes: true,
  kind: true,
  serviceId: true,
  durationMinutes: true,
  startsRegistry: true,
} as const;

/**
 * Regras de cronograma por pacote (D-01). `set` substitui a lista inteira;
 * lista vazia remove a regra. Erros de regra voltam no payload `errors`.
 */
@Injectable()
export class PackageTimelineService {
  constructor(private readonly tenant: TenantContextService) {}

  list(orgId: string, packageId: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.packageTimelineStep.findMany({
        where: { packageId },
        orderBy: { displayOrder: 'asc' },
        select: STEP_SELECT,
      }),
    );
  }

  async set(orgId: string, memberId: string, input: SetPackageTimelineInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const pkg = await tx.package.findFirst({
        where: { id: input.packageId, deletedAt: null },
        include: { services: { select: { serviceId: true } } },
      });
      if (!pkg) {
        const errors: PackageTimelineError[] = [
          { code: 'NOT_FOUND', message: 'Pacote não encontrado.', field: 'packageId' },
        ];
        return { steps: [], errors };
      }

      const errors = validatePackageTimelineSteps(
        input.steps,
        new Set(pkg.services.map((s) => s.serviceId)),
      );
      if (errors.length > 0) return { steps: [], errors };

      await tx.packageTimelineStep.deleteMany({ where: { packageId: pkg.id } });
      if (input.steps.length > 0) {
        await tx.packageTimelineStep.createMany({
          data: input.steps.map((s, i) => ({
            organizationId: orgId,
            packageId: pkg.id,
            displayOrder: i,
            isExtra: s.isExtra,
            name: s.name.trim(),
            offsetMinutes: s.offsetMinutes,
            kind: s.kind ?? null,
            serviceId: s.kind ? (s.serviceId ?? null) : null,
            durationMinutes: s.kind ? (s.durationMinutes ?? null) : null,
            startsRegistry: !!s.startsRegistry && !s.isExtra,
          })),
        });
      }
      await recordAudit(tx, {
        orgId,
        actorMemberId: memberId,
        action: 'package.timeline.set',
        entityType: 'package',
        entityId: pkg.id,
        metadata: { steps: input.steps.length },
      });

      const steps = await tx.packageTimelineStep.findMany({
        where: { packageId: pkg.id },
        orderBy: { displayOrder: 'asc' },
        select: STEP_SELECT,
      });
      return { steps, errors: [] as PackageTimelineError[] };
    });
  }
}
