import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import { ContractAcceptanceService } from './contract-acceptance.service';
import { ContractPdfService } from './contract-pdf.service';

@Resolver()
export class ContractDocumentsResolver {
  constructor(
    private readonly acceptance: ContractAcceptanceService,
    private readonly pdf: ContractPdfService,
  ) {}

  @Query('contractPdf')
  @RequirePermission(PERMISSIONS.CONTRACT_READ)
  async contractPdf(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    const data = await this.acceptance.pdfDataForOwner(tenant.organizationId, id);
    if (!data) return null;
    const buffer = await this.pdf.render(data);
    return { filename: data.fileName ?? `contrato-${data.code}.pdf`, base64: buffer.toString('base64') };
  }
}
