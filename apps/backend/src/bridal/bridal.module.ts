import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { BridalResolver } from './bridal.resolver';
import { BridalService } from './bridal.service';
import { BridalTimelineResolver } from './timeline/timeline.resolver';
import { BridalTimelineService } from './timeline/timeline.service';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [BridalService, BridalResolver, BridalTimelineService, BridalTimelineResolver],
  exports: [BridalService, BridalTimelineService],
})
export class BridalModule {}
