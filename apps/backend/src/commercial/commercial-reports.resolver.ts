import { ForbiddenException } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { AccessService, type AccessGqlContext } from '../authz/access/access.service';
import { RequireAccess } from '../authz/decorators/require-access.decorator';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { commercialViewerFrom, type CommercialViewer } from './commercial-access';
import { CommercialDashboardService } from './commercial-dashboard.service';
import {
  CommercialReportsService,
  type CommercialReportFilterDto,
} from './commercial-reports.service';

@Resolver()
export class CommercialReportsResolver {
  constructor(
    private readonly dashboard: CommercialDashboardService,
    private readonly reports: CommercialReportsService,
    private readonly access: AccessService,
  ) {}

  private async viewer(ctx: AccessGqlContext, items: readonly string[]): Promise<CommercialViewer> {
    const access = await this.access.forContext(ctx);
    if (!access) throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    return commercialViewerFrom(access, access.memberId, items);
  }

  @Query('commercialDashboard')
  @RequireAccess('comercial-painel')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  async commercialDashboard(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('periodDays') periodDays?: number,
  ) {
    return this.dashboard.get(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-painel']),
      periodDays,
    );
  }

  @Query('commercialReport')
  @RequireAccess('comercial-relatorios')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async commercialReport(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('filter') filter: CommercialReportFilterDto,
  ) {
    return this.reports.report(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-relatorios']),
      filter,
    );
  }

  @Query('exportCommercialReport')
  @RequireAccess('comercial-relatorios')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  async exportCommercialReport(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('filter') filter: CommercialReportFilterDto,
    @Args('format') format: string,
  ) {
    return this.reports.export(
      tenant.organizationId,
      await this.viewer(ctx, ['comercial-relatorios']),
      filter,
      format,
    );
  }
}
