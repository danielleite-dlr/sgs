import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { CommercialIntakeModule } from './commercial-intake.module';
import { CommercialRemindersModule } from './commercial-reminders.module';
import { CommercialReportsModule } from './commercial-reports.module';
import { CommercialLeadsService } from './commercial-leads.service';
import { CommercialStagesService } from './commercial-stages.service';
import { CommercialWinModule } from './commercial-win.module';
import { CommercialResolver } from './commercial.resolver';

/** Serviços do núcleo (etapas e leads); os submódulos importam este para evitar ciclo. */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [CommercialStagesService, CommercialLeadsService, CommercialResolver],
  exports: [CommercialStagesService, CommercialLeadsService],
})
export class CommercialCoreModule {}

@Module({
  imports: [
    CommercialCoreModule,
    CommercialWinModule,
    CommercialRemindersModule,
    CommercialReportsModule,
    CommercialIntakeModule,
  ],
})
export class CommercialModule {}
