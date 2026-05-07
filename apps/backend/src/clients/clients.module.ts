import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthzModule } from '../authz/authz.module';
import { ClientsService } from './clients.service';
import { ClientsResolver } from './clients.resolver';

/**
 * ClientsModule — client profile management (CLI-01, CLI-02).
 *
 * Phase 2: CRUD with CPF validation, duplicate lookup, soft-delete, restore,
 * and a history stub ready for Phase 3 appointment/comanda aggregation.
 *
 * Phase 3 will populate clientHistory by importing ClientsService here and
 * adding appointment/comanda aggregation to the history() method.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [ClientsService, ClientsResolver],
  exports: [ClientsService],
})
export class ClientsModule {}
