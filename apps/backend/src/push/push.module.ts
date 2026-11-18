import { BullModule } from '@nestjs/bullmq';
import { Global, Logger, Module, type Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseModule } from '../database/database.module';
import { AuthzModule } from '../authz/authz.module';
import { DeviceTokensService } from './device-tokens.service';
import { DeviceTokensResolver } from './device-tokens.resolver';
import { PushConfigResolver } from './push-config.resolver';
import { createPushProvider } from './fcm-push.provider';
import { PushEventsService } from './push-events.service';
import { PushProcessor } from './push.processor';
import { PushService } from './push.service';
import { PUSH_PROVIDER, PUSH_QUEUE } from './push.types';

// Worker lido de process.env na carga do módulo, igual aos alertas de contrato;
// as suítes de integração definem 'false'.
const workerProviders: Provider[] =
  process.env.PUSH_NOTIFICATIONS_WORKER !== 'false' ? [PushProcessor] : [];

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: PUSH_QUEUE }), DatabaseModule, AuthzModule],
  providers: [
    DeviceTokensService,
    DeviceTokensResolver,
    PushConfigResolver,
    PushEventsService,
    PushService,
    {
      provide: PUSH_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const provider = createPushProvider(config.fcmServiceAccount);
        new Logger('PushModule').log(
          provider.enabled
            ? 'Push FCM habilitado'
            : 'Push desabilitado (sem FCM_SERVICE_ACCOUNT_JSON)',
        );
        return provider;
      },
    },
    ...workerProviders,
  ],
  exports: [DeviceTokensService, PushEventsService, PushService],
})
export class PushModule {}
