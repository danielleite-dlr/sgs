import { ForbiddenException } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessService, type AccessGqlContext } from '../authz/access/access.service';
import { RequireAccess } from '../authz/decorators/require-access.decorator';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { commercialViewerFrom, type CommercialViewer } from './commercial-access';
import {
  CommercialFormSettingsService,
  type UpdateCommercialFormSettingsDto,
} from './commercial-form-settings.service';
import { CommercialImportService } from './commercial-import.service';

@Resolver()
export class CommercialIntakeResolver {
  constructor(
    private readonly imports: CommercialImportService,
    private readonly form: CommercialFormSettingsService,
    private readonly access: AccessService,
  ) {}

  private async viewer(ctx: AccessGqlContext, items: readonly string[]): Promise<CommercialViewer> {
    const access = await this.access.forContext(ctx);
    if (!access) throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    return commercialViewerFrom(access, access.memberId, items);
  }

  @Query('commercialFormSettings')
  @RequireAccess('comercial-config')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  commercialFormSettings(@CurrentTenant() tenant: TenantContext) {
    return this.form.get(tenant.organizationId);
  }

  @Mutation('updateCommercialFormSettings')
  @RequireAccess('comercial-config')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async updateCommercialFormSettings(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: UpdateCommercialFormSettingsDto,
  ) {
    return this.form.update(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('regenerateCommercialFormToken')
  @RequireAccess('comercial-config')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  regenerateCommercialFormToken(@CurrentTenant() tenant: TenantContext) {
    return this.form.regenerate(tenant.organizationId, tenant.memberId);
  }

  @Mutation('previewCommercialLeadImport')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async previewCommercialLeadImport(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('base64') base64: string,
    @Args('filename') filename: string,
  ) {
    return this.imports.preview(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      base64,
      filename,
    );
  }

  @Mutation('importCommercialLeads')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async importCommercialLeads(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('base64') base64: string,
    @Args('filename') filename: string,
  ) {
    return this.imports.import(
      tenant.organizationId,
      await this.viewer(ctx, ['COMERCIAL_NEGOCIOS']),
      base64,
      filename,
    );
  }
}
