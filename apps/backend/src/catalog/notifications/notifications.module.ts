import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';

/**
 * NotificationsModule — in-app notification center (stock alerts etc).
 * Wave 2 plan adds: NotificationService, NotificationResolver, NotificationDto.
 * Phase 5 adds email/WhatsApp delivery on top of this foundation.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class NotificationsModule {}
