import { Injectable } from '@nestjs/common';
import type { Client } from '@prisma/client';
import { mapBridalError } from '../bridal/bridal-errors';
import { ClientFieldError, createClientTx, updateClientTx } from '../clients/client-tx';
import { ContractsService } from '../contracts/contracts.service';
import { mapContractError } from '../contracts/contract-errors';
import { recordContractPaymentsTx } from '../contracts/payments/contract-payments';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { canWinAs, visibilityWhere, type CommercialViewer } from './commercial-access';
import { CommercialError, mapCommercialError, type CommercialUserError } from './commercial-errors';
import { findDuplicatesTx } from './commercial-leads.service';
import { ensureDefaultStagesTx } from './commercial-stages.service';

export interface CommercialWinClientDto {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  rg?: string | null;
  birthDate?: string | null;
  postalCode?: string | null;
  address?: string | null;
  phone2?: string | null;
  phone3?: string | null;
}

export interface WinCommercialDealDto {
  dealId: string;
  client?: CommercialWinClientDto | null;
  beneficiaryName?: string | null;
  depositPaid: boolean;
  depositLines?: { method: string; amount: string }[] | null;
  discountDescription?: string | null;
}

export interface CommercialWinPayload {
  contractId: string | null;
  clientId: string | null;
  errors: CommercialUserError[];
}

const clean = (v: string | null | undefined): string | undefined => {
  const t = (v ?? '').trim();
  return t === '' ? undefined : t;
};

/** Campos do modal que vieram preenchidos (vazio não apaga dado da cliente). */
function modalFields(c: CommercialWinClientDto | null | undefined) {
  const out: Record<string, string> = {};
  for (const k of [
    'fullName',
    'phone',
    'email',
    'cpf',
    'rg',
    'birthDate',
    'postalCode',
    'address',
    'phone2',
    'phone3',
  ] as const) {
    const v = clean(c?.[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

@Injectable()
export class CommercialWinService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly contracts: ContractsService,
  ) {}

  /**
   * Ganho atômico: resolve a cliente, cria grupo + contrato rascunho, lança o sinal e fecha o
   * negócio, tudo numa única transação. Erros saem sempre como exceção de dentro do callback
   * (rollback total) e só viram payload aqui fora.
   */
  async win(
    orgId: string,
    viewer: CommercialViewer,
    input: WinCommercialDealDto,
  ): Promise<CommercialWinPayload> {
    // D-21 + fase 10: único ponto de decisão de quem pode ganhar (commercial-access.ts)
    if (!canWinAs(viewer)) {
      return this.fail(
        new CommercialError('WIN_NOT_ALLOWED', 'Seu perfil não pode marcar negócios como ganhos.'),
      );
    }
    try {
      return await this.tenant.runWithTenant(orgId, (tx) => this.winTx(tx, orgId, viewer, input), {
        timeout: 30_000,
        maxWait: 10_000,
      });
    } catch (e) {
      return this.fail(e);
    }
  }

  private fail(e: unknown): CommercialWinPayload {
    let err: CommercialUserError | null = mapCommercialError(e);
    err ??= mapContractError(e);
    err ??= mapBridalError(e);
    if (!err && e instanceof ClientFieldError) {
      err = { code: e.code, message: e.message, field: e.field };
    }
    if (!err) throw e;
    return {
      contractId: null,
      clientId: null,
      errors: [{ code: err.code, message: err.message, field: err.field ?? null }],
    };
  }

  private async winTx(
    tx: TenantPrismaClient,
    orgId: string,
    viewer: CommercialViewer,
    input: WinCommercialDealDto,
  ): Promise<CommercialWinPayload> {
    const notFound = () => new CommercialError('NOT_FOUND', 'Negócio não encontrado.', 'dealId');

    // trava a linha: o segundo clique espera o primeiro e então vê o negócio fechado
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM commercial_deals
      WHERE id = ${input.dealId}::uuid AND deleted_at IS NULL FOR UPDATE`;
    if (locked.length === 0) throw notFound();

    const deal = await tx.commercialDeal.findFirst({
      where: { id: input.dealId, ...(visibilityWhere(viewer).deal as object) },
      include: { lead: true },
    });
    if (!deal) throw notFound();
    if (deal.status !== 'open') {
      throw new CommercialError('DEAL_CLOSED', 'Este negócio já foi encerrado.', 'dealId');
    }
    if (!deal.packageId) {
      throw new CommercialError(
        'PACKAGE_REQUIRED',
        'Escolha o pacote antes de ganhar.',
        'packageId',
      );
    }
    if (!deal.eventDate) {
      throw new CommercialError(
        'EVENT_DATE_REQUIRED',
        'Informe a data do evento antes de ganhar.',
        'eventDate',
      );
    }
    const eventDate = deal.eventDate.toISOString().slice(0, 10);

    const beneficiaryName = clean(input.beneficiaryName) ?? clean(deal.beneficiaryName);
    if (deal.kind === 'debutante' && !beneficiaryName) {
      throw new CommercialError(
        'BENEFICIARY_REQUIRED',
        'Informe o nome da debutante.',
        'beneficiaryName',
      );
    }

    const lead = deal.lead;
    const clientId = await this.resolveClient(tx, orgId, lead, input.client);

    const newGroup =
      deal.kind === 'debutante'
        ? {
            eventKind: 'debutante',
            eventDate,
            bride: { newClient: { fullName: beneficiaryName as string } },
            responsibleClientId: clientId,
            locationName: deal.location ?? undefined,
            notes: deal.notes ?? undefined,
          }
        : {
            eventKind: 'noiva',
            eventDate,
            bride: { clientId },
            locationName: deal.location ?? undefined,
            notes: deal.notes ?? undefined,
          };

    const discount = deal.discountAmount;
    const contractId = await this.contracts.createInTx(tx, orgId, viewer.memberId, {
      newGroup,
      packageId: deal.packageId,
      discountAmount: discount.gt(0) ? discount.toFixed(2) : null,
      discountDescription: clean(input.discountDescription) ?? null,
    } as Parameters<ContractsService['createInTx']>[3]);

    if (input.depositPaid) {
      await recordContractPaymentsTx(
        tx,
        orgId,
        viewer.memberId,
        contractId,
        input.depositLines ?? [],
        'Sinal lançado pelo Comercial',
      );
    }

    await ensureDefaultStagesTx(tx, orgId);
    const won = await tx.commercialStage.findFirst({ where: { kind: 'won' } });
    if (!won) throw new CommercialError('STAGE_NOT_FOUND', 'Etapa Ganho não encontrada.');

    const now = new Date();
    await tx.commercialDeal.update({
      where: { id: deal.id },
      data: {
        status: 'won',
        stageId: won.id,
        stageEnteredAt: now,
        closedAt: now,
        lastInteractionAt: now,
        wonContractId: contractId,
        wonClientId: clientId,
        ...(input.beneficiaryName !== undefined && clean(input.beneficiaryName)
          ? { beneficiaryName: clean(input.beneficiaryName) }
          : {}),
      },
    });
    await tx.commercialInteraction.create({
      data: {
        organizationId: orgId,
        leadId: lead.id,
        dealId: deal.id,
        type: 'other',
        notes: 'Negócio ganho: contrato criado',
        occurredAt: now,
        createdBy: viewer.memberId,
      },
    });

    return { contractId, clientId, errors: [] };
  }

  /** Cliente ligada ao lead, cliente do SGS com o mesmo contato, ou nova cliente (nessa ordem). */
  private async resolveClient(
    tx: TenantPrismaClient,
    orgId: string,
    lead: {
      id: string;
      fullName: string;
      phone: string | null;
      email: string | null;
      clientId: string | null;
    },
    modal: CommercialWinClientDto | null | undefined,
  ): Promise<string> {
    const fields = modalFields(modal);

    let existingId = lead.clientId;
    if (!existingId) {
      const dup = await findDuplicatesTx(tx, { phone: lead.phone, email: lead.email });
      if (dup.clients.length > 0) {
        const first = await tx.client.findFirst({
          where: { id: { in: dup.clients.map((c) => c.id) }, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        existingId = first?.id ?? null;
      }
    }

    let client: Client;
    if (existingId) {
      // cliente existente não é renomeada pelo modal
      const rest: Record<string, string> = { ...fields };
      delete rest.fullName;
      client =
        Object.keys(rest).length > 0
          ? await updateClientTx(tx, orgId, { id: existingId, ...rest })
          : await this.mustFind(tx, existingId);
    } else {
      client = await createClientTx(tx, orgId, {
        ...fields,
        fullName: fields.fullName ?? lead.fullName,
        phone: fields.phone ?? clean(lead.phone),
        email: fields.email ?? clean(lead.email),
      });
    }
    if (lead.clientId !== client.id) {
      await tx.commercialLead.update({ where: { id: lead.id }, data: { clientId: client.id } });
    }
    return client.id;
  }

  private async mustFind(tx: TenantPrismaClient, id: string): Promise<Client> {
    const c = await tx.client.findFirst({ where: { id, deletedAt: null } });
    if (!c) throw new ClientFieldError('NOT_FOUND', 'Cliente não encontrada.');
    return c;
  }
}
