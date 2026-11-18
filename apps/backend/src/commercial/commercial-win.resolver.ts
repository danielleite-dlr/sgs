import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { CommercialWinService, type WinCommercialDealDto } from './commercial-win.service';

@Resolver()
export class CommercialWinResolver {
  constructor(private readonly win: CommercialWinService) {}

  // D-21: o resolver exige só commercial.write; quem pode ganhar é decidido por canWinDeal no serviço
  @Mutation('winCommercialDeal')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  winCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: WinCommercialDealDto,
  ) {
    return this.win.win(tenant.organizationId, tenant, input);
  }
}
