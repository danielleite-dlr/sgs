import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Common interface for all email delivery adapters (production + test). */
export interface EmailAdapter {
  send(params: SendEmailParams): Promise<void>;
}

/**
 * ResendAdapter — thin HTTP client for the Resend transactional email API.
 *
 * Dev fallback: when RESEND_API_KEY is not set, logs to console instead of
 * sending. This allows local development without a Resend account.
 */
@Injectable()
export class ResendAdapter implements EmailAdapter {
  private readonly logger = new Logger(ResendAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(params: SendEmailParams): Promise<void> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    const from = this.config.get('EMAIL_FROM', { infer: true });

    if (!apiKey) {
      // Dev fallback: log instead of sending
      this.logger.warn(
        `[email-fallback] to=${params.to} subject="${params.subject}"\n${params.text ?? params.html}`,
      );
      return;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend send failed: ${res.status} ${body}`);
    }
  }
}
