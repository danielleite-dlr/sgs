import { Injectable } from '@nestjs/common';
import { recordAudit } from '../common/audit-log';
import { fromCents, toCents } from '../common/money';
import { TenantContextService } from '../database/tenant-context.service';
import {
  CreditError,
  getCreditBalanceCents,
  lockClient,
  recordCreditMovement,
} from './client-credit';

export interface FinancialUserError {
  code: string;
  message: string;
  field: string | null;
}

const ADJUST_RE = /^-?\d+(\.\d{1,2})?$/;

@Injectable()
export class ClientCreditService {
  constructor(private readonly tenant: TenantContextService) {}

  /** Clientes com saldo > 0, ordem alfabética. */
  async balances(orgId: string) {
    const rows = await this.tenant.runWithTenant(orgId, (tx) =>
      tx.$queryRaw<{ client_id: string; full_name: string; balance: string }[]>`
        SELECT c.id AS client_id, c.full_name, SUM(m.amount)::text AS balance
          FROM client_credit_movements m
          JOIN clients c ON c.id = m.client_id
         GROUP BY c.id, c.full_name
        HAVING SUM(m.amount) > 0
         ORDER BY c.full_name`,
    );
    return rows.map((r) => ({
      clientId: r.client_id,
      clientName: r.full_name,
      balance: fromCents(toCents(r.balance)),
    }));
  }

  async movements(orgId: string, clientId: string) {
    const rows = await this.tenant.runWithTenant(orgId, (tx) =>
      tx.clientCreditMovement.findMany({
        where: { clientId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    return rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      amount: fromCents(toCents(m.amount)),
      reason: m.reason,
      appointmentId: m.appointmentId,
      comandaId: m.comandaId,
      createdAt: m.createdAt,
    }));
  }

  async balance(orgId: string, clientId: string): Promise<string> {
    const cents = await this.tenant.runWithTenant(orgId, (tx) =>
      getCreditBalanceCents(tx, clientId),
    );
    return fromCents(cents);
  }

  /** Ajuste manual (D-11): exige motivo; gera audit_log; nunca deixa o saldo negativo. */
  async adjust(
    orgId: string,
    memberId: string,
    input: { clientId: string; amount: string; reason: string },
  ): Promise<{ balance: string | null; errors: FinancialUserError[] }> {
    const err = (code: string, message: string, field: string | null) => ({
      balance: null,
      errors: [{ code, message, field }],
    });
    if (typeof input.amount !== 'string' || !ADJUST_RE.test(input.amount)) {
      return err('INVALID_AMOUNT', 'Informe um valor válido (ex.: 20.00 ou -10.00).', 'amount');
    }
    const negative = input.amount.startsWith('-');
    const cents = toCents(input.amount.replace('-', '')) * (negative ? -1 : 1);
    if (cents === 0) {
      return err('INVALID_AMOUNT', 'O ajuste não pode ser zero.', 'amount');
    }
    const reason = (input.reason ?? '').trim();
    if (reason.length < 3) {
      return err('REASON_REQUIRED', 'Informe o motivo do ajuste.', 'reason');
    }
    try {
      const balance = await this.tenant.runWithTenant(orgId, async (tx) => {
        await lockClient(tx, input.clientId);
        await recordCreditMovement(tx, {
          orgId,
          clientId: input.clientId,
          amountCents: cents,
          kind: 'manual_adjustment',
          reason,
          createdBy: memberId,
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: memberId,
          action: 'credit.adjust',
          entityType: 'client',
          entityId: input.clientId,
          reason,
          metadata: { amount: fromCents(cents) },
        });
        return getCreditBalanceCents(tx, input.clientId);
      });
      return { balance: fromCents(balance), errors: [] };
    } catch (e) {
      if (e instanceof CreditError) {
        if (e.code === 'CREDIT_INSUFFICIENT') {
          return err('CREDIT_NEGATIVE', 'O ajuste deixaria o saldo do cliente negativo.', 'amount');
        }
        return err('CLIENT_NOT_FOUND', e.message, 'clientId');
      }
      throw e;
    }
  }
}
