import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { CommercialViewer } from './commercial-access';
import {
  CommercialFormSettingsService,
  type UpdateCommercialFormSettingsDto,
} from './commercial-form-settings.service';
import { CommercialImportService } from './commercial-import.service';

const viewerOf = (t: TenantContext): CommercialViewer => ({
  roleName: t.roleName,
  memberId: t.memberId,
});

@Resolver()
export class CommercialIntakeResolver {
  constructor(
    private readonly imports: CommercialImportService,
    private readonly form: CommercialFormSettingsService,
  ) {}

  @Query('commercialFormSettings')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  commercialFormSettings(@CurrentTenant() tenant: TenantContext) {
    return this.form.get(tenant.organizationId);
  }

  @Mutation('updateCommercialFormSettings')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  updateCommercialFormSettings(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: UpdateCommercialFormSettingsDto,
  ) {
    return this.form.update(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('regenerateCommercialFormToken')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  regenerateCommercialFormToken(@CurrentTenant() tenant: TenantContext) {
    return this.form.regenerate(tenant.organizationId, tenant.memberId);
  }

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
