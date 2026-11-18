import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { CommercialViewer } from './commercial-access';
import { CommercialImportService } from './commercial-import.service';

const viewerOf = (t: TenantContext): CommercialViewer => ({
  roleName: t.roleName,
  memberId: t.memberId,
});

@Resolver()
export class CommercialIntakeResolver {
  constructor(private readonly imports: CommercialImportService) {}

  @Mutation('previewCommercialLeadImport')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  previewCommercialLeadImport(
    @CurrentTenant() tenant: TenantContext,
    @Args('base64') base64: string,
    @Args('filename') filename: string,
  ) {
    return this.imports.preview(tenant.organizationId, viewerOf(tenant), base64, filename);
  }

  @Mutation('importCommercialLeads')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  importCommercialLeads(
    @CurrentTenant() tenant: TenantContext,
    @Args('base64') base64: string,
    @Args('filename') filename: string,
  ) {
    return this.imports.import(tenant.organizationId, viewerOf(tenant), base64, filename);
  }
}
