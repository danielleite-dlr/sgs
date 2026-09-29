import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.schema";
import { ResendAdapter } from "./resend.adapter";
import { EmailService } from "./email.service";
import { EMAIL_ADAPTER } from "./email.tokens";
import { FileOutboxEmailAdapter, shouldUseOutbox } from "./file-outbox.adapter";

// Re-export for backwards compatibility (other modules import it from here)
export { EMAIL_ADAPTER };

/**
 * EmailModule — global provider for transactional email services.
 * EmailService and EMAIL_ADAPTER token are exported so any module
 * can inject them without explicit imports.
 *
 * EMAIL_ADAPTER resolves to ResendAdapter, except when EMAIL_OUTBOX_DIR is set
 * and NODE_ENV != production (E2E): then emails are written to that directory.
 */
@Global()
@Module({
  providers: [
    ResendAdapter,
    {
      provide: EMAIL_ADAPTER,
      inject: [ConfigService, ResendAdapter],
      useFactory: (config: ConfigService<Env, true>, resend: ResendAdapter) => {
        const dir = config.get("EMAIL_OUTBOX_DIR", { infer: true });
        if (shouldUseOutbox(config.get("NODE_ENV", { infer: true }), dir)) {
          new Logger("EmailModule").warn(
            `EMAIL_OUTBOX_DIR active: emails are written to ${dir} instead of being sent`,
          );
          return new FileOutboxEmailAdapter(dir as string);
        }
        return resend;
      },
    },
    EmailService,
  ],
  exports: [EmailService, EMAIL_ADAPTER],
})
export class EmailModule {}
