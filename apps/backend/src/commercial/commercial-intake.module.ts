import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { CommercialFormSettingsService } from './commercial-form-settings.service';
import { CommercialImportService } from './commercial-import.service';
import { CommercialIntakeResolver } from './commercial-intake.resolver';
import { PublicLeadController } from './public-lead.controller';
import { PublicLeadService } from './public-lead.service';

/**
 * Entradas externas de leads: importação de planilha e formulário público do site.
 * O PublicLeadController usa ThrottlerGuard: o ThrottlerModule é @Global e já é registrado com
 * forRoot em ContractAcceptanceModule. Não chamar forRoot aqui (dois registros conflitam).
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  controllers: [PublicLeadController],
  providers: [
    CommercialImportService,
    CommercialFormSettingsService,
    PublicLeadService,
    CommercialIntakeResolver,
  ],
  exports: [CommercialImportService, CommercialFormSettingsService],
})
export class CommercialIntakeModule {}
