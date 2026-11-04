import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { BridalResolver } from './bridal.resolver';
import { BridalService } from './bridal.service';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [BridalService, BridalResolver],
  exports: [BridalService],
})
export class BridalModule {}
