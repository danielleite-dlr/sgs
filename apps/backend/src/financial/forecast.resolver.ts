import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../authz/decorators/current-tenant.decorator';
import { RequireAccess } from '../authz/decorators/require-access.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { ForecastService } from './forecast.service';

@Resolver()
export class ForecastResolver {
  constructor(private readonly forecast: ForecastService) {}

  @Query('cashForecast')
  @RequireAccess('fin-previsao')
  @RequirePermission(PERMISSIONS.FINANCIAL_READ)
  cashForecast(
    @CurrentTenant() tenant: TenantContext,
    @Args('from') from: string,
    @Args('to') to: string,
    @Args('nature') nature: string,
    @Args('origin') origin: string,
  ) {
    return this.forecast.forecast(tenant.organizationId, from, to, nature, origin);
  }
}
