import { ForbiddenException } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { AccessService, type AccessGqlContext } from '../authz/access/access.service';
import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
import { RequireAccess } from '../authz/decorators/require-access.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { commercialViewerFrom } from './commercial-access';
import { CommercialWinService, type WinCommercialDealDto } from './commercial-win.service';

@Resolver()
export class CommercialWinResolver {
  constructor(
    private readonly win: CommercialWinService,
    private readonly access: AccessService,
  ) {}

  // D-21: o resolver exige o item e commercial.write; quem pode ganhar é decidido por canWinAs no serviço
  @Mutation('winCommercialDeal')
  @RequireAccess('COMERCIAL_NEGOCIOS')
  @RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)
  async winCommercialDeal(
    @CurrentTenant() tenant: TenantContext,
    @Context() ctx: AccessGqlContext,
    @Args('input') input: WinCommercialDealDto,
  ) {
    const access = await this.access.forContext(ctx);
    if (!access) throw new ForbiddenException('FORBIDDEN: membro inativo ou inexistente');
    const viewer = commercialViewerFrom(access, access.memberId, ['COMERCIAL_NEGOCIOS']);
    return this.win.win(tenant.organizationId, viewer, input);
  }
}
