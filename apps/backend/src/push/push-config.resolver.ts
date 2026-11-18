import { Query, Resolver } from '@nestjs/graphql';
import { AppConfigService } from '../config/app-config.service';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';

@Resolver()
export class PushConfigResolver {
  constructor(private readonly config: AppConfigService) {}

  @Query('pushConfig')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  pushConfig(): { webPushPublicKey: string | null } {
    return { webPushPublicKey: this.config.vapid?.publicKey ?? null };
  }
}
