import { Global, Module } from '@nestjs/common';
import { ResendAdapter } from './resend.adapter';
import { EmailService } from './email.service';

/**
 * EMAIL_ADAPTER is an injection token that decouples EmailService from the
 * concrete adapter. In production, it resolves to ResendAdapter. In tests,
 * override it with TestEmailAdapter for in-memory email capture:
 *
 *   moduleRef = await Test.createTestingModule({ imports: [AppModule] })
 *     .overrideProvider(EMAIL_ADAPTER)
 *     .useClass(TestEmailAdapter)
 *     .compile();
 */
export const EMAIL_ADAPTER = Symbol('EMAIL_ADAPTER');

/**
 * EmailModule — global provider for transactional email services.
 * EmailService and EMAIL_ADAPTER token are exported so any module
 * can inject them without explicit imports.
 */
@Global()
@Module({
  providers: [
    ResendAdapter,
    { provide: EMAIL_ADAPTER, useExisting: ResendAdapter },
    EmailService,
  ],
  exports: [EmailService, EMAIL_ADAPTER],
})
export class EmailModule {}
