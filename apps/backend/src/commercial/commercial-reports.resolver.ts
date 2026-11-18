import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { CommercialViewer } from './commercial-access';
import { CommercialDashboardService } from './commercial-dashboard.service';
import {
  CommercialReportsService,
  type CommercialReportFilterDto,
} from './commercial-reports.service';

const viewerOf = (t: TenantContext): CommercialViewer => ({
  roleName: t.roleName,
  memberId: t.memberId,
});

@Resolver()
export class CommercialReportsResolver {
  constructor(
    private readonly dashboard: CommercialDashboardService,
    private readonly reports: CommercialReportsService,
  ) {}

  @Query('commercialDashboard')
  @RequirePermission(PERMISSIONS.COMMERCIAL_READ)
  commercialDashboard(
    @CurrentTenant() tenant: TenantContext,
    @Args('periodDays') periodDays?: number,
  ) {
    return this.dashboard.get(tenant.organizationId, viewerOf(tenant), periodDays);
  }

  @Query('commercialReport')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  commercialReport(
    @CurrentTenant() tenant: TenantContext,
    @Args('filter') filter: CommercialReportFilterDto,
  ) {
    return this.reports.report(tenant.organizationId, viewerOf(tenant), filter);
  }

  @Query('exportCommercialReport')
  @RequirePermission(PERMISSIONS.COMMERCIAL_MANAGE)
  exportCommercialReport(
    @CurrentTenant() tenant: TenantContext,
    @Args('filter') filter: CommercialReportFilterDto,
    @Args('format') format: string,
  ) {
    return this.reports.export(tenant.organizationId, viewerOf(tenant), filter, format);
  }
}
