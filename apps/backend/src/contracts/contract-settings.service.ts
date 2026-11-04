import { Injectable } from '@nestjs/common';
import { recordAudit } from '../common/audit-log';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { DEFAULT_CANCELLATION_CLAUSE } from './domain/cancellation-policy';
import {
  DEFAULT_BRIDAL_TEMPLATE,
  TEMPLATE_VARIABLES,
  validateTemplate,
} from './domain/contract-template';
import { ContractError, mapContractError, type ContractUserError } from './contract-errors';

export interface ContractSettingsView {
  balanceDueDaysBefore: number;
  templateBody: string;
  isDefaultTemplate: boolean;
  cancellationClause: string;
  isDefaultClause: boolean;
  alertDepositUnpaidDays: number;
  alertNotAcceptedDays: number;
  alertCompanionDepositDays: number;
  scheduleDayStart: string;
  scheduleDayEnd: string;
  templateVariables: string[];
  missingVariables: string[];
}

export interface UpdateContractSettingsInput {
  balanceDueDaysBefore?: number | null;
  templateBody?: string | null;
  cancellationClause?: string | null;
  alertDepositUnpaidDays?: number | null;
  alertNotAcceptedDays?: number | null;
  alertCompanionDepositDays?: number | null;
  scheduleDayStart?: string | null;
  scheduleDayEnd?: string | null;
}

interface SettingsRow {
  balance_due_days_before: number;
  template_body: string | null;
  cancellation_clause: string | null;
  alert_deposit_unpaid_days: number;
  alert_not_accepted_days: number;
  alert_companion_deposit_days: number;
  day_start: string;
  day_end: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const DEFAULTS: SettingsRow = {
  balance_due_days_before: 10,
  template_body: null,
  cancellation_clause: null,
  alert_deposit_unpaid_days: 3,
  alert_not_accepted_days: 3,
  alert_companion_deposit_days: 15,
  day_start: '06:00',
  day_end: '20:00',
};

function toView(r: SettingsRow): ContractSettingsView {
  const templateBody = r.template_body ?? DEFAULT_BRIDAL_TEMPLATE;
  return {
    balanceDueDaysBefore: r.balance_due_days_before,
    templateBody,
    isDefaultTemplate: r.template_body === null,
    cancellationClause: r.cancellation_clause ?? DEFAULT_CANCELLATION_CLAUSE,
    isDefaultClause: r.cancellation_clause === null,
    alertDepositUnpaidDays: r.alert_deposit_unpaid_days,
    alertNotAcceptedDays: r.alert_not_accepted_days,
    alertCompanionDepositDays: r.alert_companion_deposit_days,
    scheduleDayStart: r.day_start,
    scheduleDayEnd: r.day_end,
    templateVariables: [...TEMPLATE_VARIABLES],
    missingVariables: validateTemplate(templateBody).missing,
  };
}

async function loadRow(tx: TenantPrismaClient, orgId: string): Promise<SettingsRow | null> {
  const rows = await tx.$queryRaw<SettingsRow[]>`
    SELECT balance_due_days_before, template_body, cancellation_clause,
           alert_deposit_unpaid_days, alert_not_accepted_days, alert_companion_deposit_days,
           to_char(schedule_day_start, 'HH24:MI') AS day_start,
           to_char(schedule_day_end, 'HH24:MI') AS day_end
      FROM contract_settings WHERE organization_id = ${orgId}::uuid`;
  return rows[0] ?? null;
}

/** Configuração efetiva (linha da org ou padrões) dentro de uma transação de tenant. */
export async function loadEffectiveSettings(
  tx: TenantPrismaClient,
  orgId: string,
): Promise<ContractSettingsView> {
  return toView((await loadRow(tx, orgId)) ?? DEFAULTS);
}

const timeToDate = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

function checkInt(v: number, min: number, max: number, field: string): number {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new ContractError(
      'INVALID_DAYS',
      `Informe um número de dias entre ${min} e ${max}.`,
      field,
    );
  }
  return v;
}

@Injectable()
export class ContractSettingsService {
  constructor(private readonly tenant: TenantContextService) {}

  /** Configuração efetiva (linha da org ou padrões), dentro da transação do chamador. */
  async getEffective(tx: TenantPrismaClient, orgId: string): Promise<ContractSettingsView> {
    return loadEffectiveSettings(tx, orgId);
  }

  get(orgId: string): Promise<ContractSettingsView> {
    return this.tenant.runWithTenant(orgId, (tx) => this.getEffective(tx, orgId));
  }

  async update(
    orgId: string,
    memberId: string,
    input: UpdateContractSettingsInput,
  ): Promise<{ settings: ContractSettingsView | null; errors: ContractUserError[] }> {
    try {
      const settings = await this.tenant.runWithTenant(orgId, async (tx) => {
        const next: SettingsRow = { ...((await loadRow(tx, orgId)) ?? DEFAULTS) };

        if (input.balanceDueDaysBefore != null) {
          next.balance_due_days_before = checkInt(
            input.balanceDueDaysBefore,
            0,
            365,
            'balanceDueDaysBefore',
          );
        }
        if (input.alertDepositUnpaidDays != null) {
          next.alert_deposit_unpaid_days = checkInt(
            input.alertDepositUnpaidDays,
            0,
            90,
            'alertDepositUnpaidDays',
          );
        }
        if (input.alertNotAcceptedDays != null) {
          next.alert_not_accepted_days = checkInt(
            input.alertNotAcceptedDays,
            0,
            90,
            'alertNotAcceptedDays',
          );
        }
        if (input.alertCompanionDepositDays != null) {
          next.alert_companion_deposit_days = checkInt(
            input.alertCompanionDepositDays,
            0,
            365,
            'alertCompanionDepositDays',
          );
        }

        if (input.templateBody !== undefined) {
          if (input.templateBody === null) {
            next.template_body = null;
          } else {
            const { unknown } = validateTemplate(input.templateBody);
            if (unknown.length > 0) {
              throw new ContractError(
                'UNKNOWN_TEMPLATE_VARIABLE',
                `Variáveis desconhecidas no modelo: ${unknown.map((v) => `{{${v}}}`).join(', ')}.`,
                'templateBody',
              );
            }
            next.template_body = input.templateBody;
          }
        }
        if (input.cancellationClause !== undefined) {
          if (input.cancellationClause === null) {
            next.cancellation_clause = null;
          } else {
            const len = input.cancellationClause.trim().length;
            if (len < 10 || len > 5000) {
              throw new ContractError(
                'INVALID_CLAUSE',
                'A cláusula deve ter entre 10 e 5000 caracteres.',
                'cancellationClause',
              );
            }
            next.cancellation_clause = input.cancellationClause;
          }
        }

        if (input.scheduleDayStart != null) next.day_start = input.scheduleDayStart;
        if (input.scheduleDayEnd != null) next.day_end = input.scheduleDayEnd;
        if (!TIME_RE.test(next.day_start) || !TIME_RE.test(next.day_end)) {
          throw new ContractError(
            'INVALID_DAY_WINDOW',
            'Use horários no formato HH:MM.',
            'scheduleDayStart',
          );
        }
        if (next.day_end <= next.day_start) {
          throw new ContractError(
            'INVALID_DAY_WINDOW',
            'O fim do dia deve ser depois do início.',
            'scheduleDayEnd',
          );
        }

        const data = {
          balanceDueDaysBefore: next.balance_due_days_before,
          templateBody: next.template_body,
          cancellationClause: next.cancellation_clause,
          alertDepositUnpaidDays: next.alert_deposit_unpaid_days,
          alertNotAcceptedDays: next.alert_not_accepted_days,
          alertCompanionDepositDays: next.alert_companion_deposit_days,
          scheduleDayStart: timeToDate(next.day_start),
          scheduleDayEnd: timeToDate(next.day_end),
          updatedBy: memberId,
        };
        await tx.contractSettings.upsert({
          where: { organizationId: orgId },
          create: { organizationId: orgId, ...data },
          update: data,
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: memberId,
          action: 'contract.settings.update',
          entityType: 'contract_settings',
          entityId: orgId,
          metadata: {
            fields: Object.entries(input)
              .filter(([, v]) => v !== undefined)
              .map(([k]) => k),
          },
        });
        return toView(next);
      });
      return { settings, errors: [] };
    } catch (e) {
      const m = mapContractError(e);
      if (m) return { settings: null, errors: [m] };
      throw e;
    }
  }
}
