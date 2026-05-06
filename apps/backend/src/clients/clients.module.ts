import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthzModule } from '../authz/authz.module';

/**
 * ClientsModule — client profile management (CLI-01, CLI-02).
 * Wave 2 plan adds: ClientService, ClientResolver, ClientDto, client.history stub.
 * Phase 3 populates history from appointments + comandas.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class ClientsModule {}
