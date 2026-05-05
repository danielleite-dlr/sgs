import { Global, Module } from '@nestjs/common';
import { ResendAdapter } from './resend.adapter';
import { EmailService } from './email.service';

/**
 * EmailModule — global provider for transactional email services.
 * EmailService is exported so any module can inject it without explicit imports.
 */
@Global()
@Module({
  providers: [ResendAdapter, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
