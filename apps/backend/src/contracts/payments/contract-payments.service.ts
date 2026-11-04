import { BadRequestException, Injectable } from '@nestjs/common';
import { mapSchedulingError } from '../../appointments/scheduling-guard';
import { fromCents } from '../../common/money';
import { TenantContextService } from '../../database/tenant-context.service';
import { BRIDAL_SCHEDULE_TX_OPTIONS } from '../../bridal/bridal-schedule';
import { mapContractError } from '../contract-errors';
import { loadContractView } from '../contract-serialize';
import type { ContractPayload } from '../contracts.service';
import {
  cancelContractTx,
  previewCancellationTx,
  recordContractPaymentsTx,
  reverseContractPaymentTx,
} from './contract-payments';

export interface RecordContractPaymentInput {
  contractId: string;
  lines: { method: string; amount: string }[];
  note?: string | null;
}

export interface CancelContractInput {
  contractId: string;
  party: string;
  reason: string;
  refundMethod?: string | null;
}

@Injectable()
export class ContractPaymentsService {
  constructor(private readonly tenant: TenantContextService) {}

  private fail(e: unknown): ContractPayload {
    const m = mapContractError(e) ?? mapSchedulingError(e);
    if (m) return { contract: null, errors: [m] };
    throw e;
  }

  async record(
    orgId: string,
    memberId: string,
    input: RecordContractPaymentInput,
  ): Promise<ContractPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        await recordContractPaymentsTx(
          tx,
          orgId,
          memberId,
          input.contractId,
          input.lines ?? [],
          input.note,
        );
        return { contract: await loadContractView(tx, orgId, input.contractId), errors: [] };
      });
    } catch (e) {
      return this.fail(e);
    }
  }

  async reverse(
    orgId: string,
    memberId: string,
    input: { paymentId: string; reason: string },
  ): Promise<ContractPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const contractId = await reverseContractPaymentTx(
          tx,
          orgId,
          memberId,
          input.paymentId,
          input.reason,
        );
        return { contract: await loadContractView(tx, orgId, contractId), errors: [] };
      });
    } catch (e) {
      return this.fail(e);
    }
  }

  async cancel(
    orgId: string,
    memberId: string,
    input: CancelContractInput,
  ): Promise<ContractPayload> {
    try {
      return await this.tenant.runWithTenant(
        orgId,
        async (tx) => {
          await cancelContractTx(tx, orgId, memberId, input);
          return { contract: await loadContractView(tx, orgId, input.contractId), errors: [] };
        },
        BRIDAL_SCHEDULE_TX_OPTIONS,
      );
    } catch (e) {
      return this.fail(e);
    }
  }

  async preview(orgId: string, contractId: string, party: string) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const r = await previewCancellationTx(tx, contractId, party);
        return {
          paid: fromCents(r.paidCents),
          retained: fromCents(r.retainedCents),
          refund: fromCents(r.refundCents),
          party,
        };
      });
    } catch (e) {
      const m = mapContractError(e);
      if (m) throw new BadRequestException(m.message);
      throw e;
    }
  }
}
