import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthzModule } from '../authz/authz.module';
import { DeviceTokensService } from './device-tokens.service';
import { DeviceTokensResolver } from './device-tokens.resolver';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [DeviceTokensService, DeviceTokensResolver],
  exports: [DeviceTokensService],
})
export class PushModule {}
