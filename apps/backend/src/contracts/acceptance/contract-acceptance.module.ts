import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ContractAcceptanceService } from './contract-acceptance.service';
import { ContractDocumentsResolver } from './contract-documents.resolver';
import { ContractPdfService } from './contract-pdf.service';
import { PublicContractController } from './public-contract.controller';

// Throttler NÃO é global: o ThrottlerGuard é aplicado só ao PublicContractController.
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
  controllers: [PublicContractController],
  providers: [ContractAcceptanceService, ContractPdfService, ContractDocumentsResolver],
})
export class ContractAcceptanceModule {}
