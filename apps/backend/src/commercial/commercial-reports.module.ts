import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { CommercialDashboardService } from './commercial-dashboard.service';
import { CommercialReportsResolver } from './commercial-reports.resolver';
import { CommercialReportsService } from './commercial-reports.service';

/** Submódulo do Comercial: Painel, Relatórios e exportação (xlsx/pdf). */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [CommercialDashboardService, CommercialReportsService, CommercialReportsResolver],
  exports: [CommercialDashboardService, CommercialReportsService],
})
export class CommercialReportsModule {}
