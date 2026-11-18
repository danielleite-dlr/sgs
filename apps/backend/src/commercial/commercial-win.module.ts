import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { ContractsModule } from '../contracts/contracts.module';
import { DatabaseModule } from '../database/database.module';
import { CommercialWinResolver } from './commercial-win.resolver';
import { CommercialWinService } from './commercial-win.service';

/** Ganho do Comercial (09-06): cliente + contrato rascunho + sinal, numa transação. */
@Module({
  imports: [DatabaseModule, AuthzModule, ContractsModule],
  providers: [CommercialWinService, CommercialWinResolver],
  exports: [CommercialWinService],
})
export class CommercialWinModule {}
