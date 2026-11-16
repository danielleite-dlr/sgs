import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import {
  DeviceTokensService,
  RegisterDeviceTokenInput,
} from './device-tokens.service';
import {
  CurrentTenant,
  TenantContext,
} from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { JwtAccessPayload } from '../auth/types';

@Resolver()
export class DeviceTokensResolver {
  constructor(private readonly tokens: DeviceTokensService) {}

  @Mutation('registerDeviceToken')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  register(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: RegisterDeviceTokenInput,
    @Context() ctx: { req?: { user?: JwtAccessPayload } },
  ): Promise<boolean> | boolean {
    // Admin de plataforma dentro do salão do cliente não recebe push do salão (decisão da fase 7).
    if (ctx.req?.user?.impersonating) return false;
    return this.tokens.register(t.organizationId, t.memberId, input);
  }

  @Mutation('unregisterDeviceToken')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  unregister(
    @CurrentTenant() t: TenantContext,
    @Args('token') token: string,
  ): Promise<boolean> {
    return this.tokens.unregister(t.organizationId, t.memberId, token);
  }
}
