import { BullModule } from '@nestjs/bullmq';
import { Module, type Provider } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { CommercialRemindersProcessor } from './commercial-reminders.processor';
import { CommercialRemindersResolver } from './commercial-reminders.resolver';
import {
  COMMERCIAL_REMINDERS_QUEUE,
  CommercialRemindersScheduler,
} from './commercial-reminders.scheduler';
import { CommercialRemindersService } from './commercial-reminders.service';

/**
 * Scheduler e processor só entram quando COMMERCIAL_REMINDERS_SCHEDULER != 'false'
 * (lido de process.env na carga do módulo; as suítes de integração definem 'false').
 * PushModule é global, então PushEventsService chega sem import.
 */
const workerProviders: Provider[] =
  process.env.COMMERCIAL_REMINDERS_SCHEDULER !== 'false'
    ? [CommercialRemindersScheduler, CommercialRemindersProcessor]
    : [];

@Module({
  imports: [
    BullModule.registerQueue({ name: COMMERCIAL_REMINDERS_QUEUE }),
    DatabaseModule,
    AuthzModule,
  ],
  providers: [CommercialRemindersService, CommercialRemindersResolver, ...workerProviders],
  exports: [CommercialRemindersService],
})
export class CommercialRemindersModule {}
