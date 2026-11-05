import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import { ContractsService, PREVIEW_CODE, type ContractPreviewInput } from '../contracts.service';
import { contractFileName } from '../domain/contract-file-name';
import { snapshotToPlainText } from '../domain/contract-snapshot';
import type { ContractUserError } from '../contract-errors';
import { ContractPdfService } from './contract-pdf.service';

export const PREVIEW_NOTICE = 'PRÉVIA — não é o contrato final';

export interface ContractPreviewPdfPayload {
  filename: string | null;
  base64: string | null;
  errors: ContractUserError[];
}

/**
 * Prévia em PDF do formulário de contrato: mesmo renderizador do "Baixar PDF"
 * (layout estruturado + papel timbrado), com o aviso de prévia no quadro de notice.
 * Somente leitura: ContractsService.preview desfaz a transação.
 */
@Resolver()
export class ContractPreviewResolver {
  constructor(
    private readonly contracts: ContractsService,
    private readonly pdf: ContractPdfService,
  ) {}

  @Query('contractPreviewPdf')
  @RequirePermission(PERMISSIONS.CONTRACT_WRITE)
  async contractPreviewPdf(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: ContractPreviewInput,
  ): Promise<ContractPreviewPdfPayload> {
    const r = await this.contracts.preview(tenant.organizationId, tenant.memberId, input);
    if ('errors' in r) return { filename: null, base64: null, errors: r.errors };
    const s = r.snapshot;
    const fileName = `PREVIA - ${contractFileName(
      s.kind,
      s.kind === 'debutante' ? (s.debutanteName ?? s.contractor.name) : s.contractor.name,
      s.event.date,
      s.budget.package?.name ?? null,
    )}`;
    const buffer = await this.pdf.render({
      snapshot: s,
      letterhead: r.letterhead,
      fileName,
      orgName: r.orgName,
      code: PREVIEW_CODE,
      text: snapshotToPlainText(s),
      version: 0,
      notice: PREVIEW_NOTICE,
      acceptance: null,
    });
    return {
      filename: fileName,
      base64: buffer.toString('base64'),
      errors: [],
    };
  }
}
