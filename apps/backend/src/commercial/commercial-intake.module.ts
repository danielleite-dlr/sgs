import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { CommercialImportService } from './commercial-import.service';
import { CommercialIntakeResolver } from './commercial-intake.resolver';

/** Entradas externas de leads: importação de planilha e formulário público do site. */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [CommercialImportService, CommercialIntakeResolver],
  exports: [CommercialImportService],
})
export class CommercialIntakeModule {}
