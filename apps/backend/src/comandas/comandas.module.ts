import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { ComandasResolver } from './comandas.resolver';
import { ComandasService } from './comandas.service';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [ComandasService, ComandasResolver],
  exports: [ComandasService],
})
export class ComandasModule {}
