import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { GraphqlModule } from './graphql/graphql.module';
import { QueueModule } from './queue/queue.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { AuthzModule } from './authz/authz.module';
import { AdminModule } from './admin/admin.module';
import { IdentityModule } from './identity/identity.module';
import { CatalogModule } from './catalog/catalog.module';
import { ClientsModule } from './clients/clients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ComandasModule } from './comandas/comandas.module';
import { FinancialModule } from './financial/financial.module';
import { BridalModule } from './bridal/bridal.module';
import { AiScheduleModule } from './bridal/ai/ai-schedule.module';
import { ContractsModule } from './contracts/contracts.module';
import { ContractPaymentsModule } from './contracts/payments/contract-payments.module';
import { ContractAcceptanceModule } from './contracts/acceptance/contract-acceptance.module';
import { ContractAlertsModule } from './contracts/alerts/contract-alerts.module';
import { envSchema } from './config/env.schema';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: (config: Record<string, unknown>) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          throw new Error(
            `Environment validation error:\n${result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n')}`,
          );
        }
        return result.data;
      },
    }),
    AppConfigModule,
    DatabaseModule,
    GraphqlModule,
    QueueModule,
    EmailModule,
    AuthModule,
    AuthzModule,
    AdminModule,
    IdentityModule,
    CatalogModule,
    ClientsModule,
    AppointmentsModule,
    ComandasModule,
    FinancialModule,
    BridalModule,
    AiScheduleModule,
    ContractsModule,
    ContractPaymentsModule,
    ContractAcceptanceModule,
    ContractAlertsModule,
    HealthModule,
  ],
})
export class AppModule {}
