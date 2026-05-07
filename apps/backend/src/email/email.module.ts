import { Global, Module } from '@nestjs/common';
import { ResendAdapter } from './resend.adapter';
import { EmailService } from './email.service';
import { EMAIL_ADAPTER } from './email.tokens';

// Re-export for backwards compatibility (other modules import it from here)
export { EMAIL_ADAPTER };

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
