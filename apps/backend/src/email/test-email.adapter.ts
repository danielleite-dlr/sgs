import { Injectable } from '@nestjs/common';
import type { EmailAdapter, SendEmailParams } from './resend.adapter';

/**
 * TestEmailAdapter — in-memory email capture for integration tests.
 *
 * Override EMAIL_ADAPTER token in test modules:
 *   .overrideProvider(EMAIL_ADAPTER).useClass(TestEmailAdapter)
 *
 * This adapter never sends real emails — it stores all calls in memory,
 * making it possible to assert on sent emails and extract tokens in tests.
 */
@Injectable()
export class TestEmailAdapter implements EmailAdapter {
  private sent: SendEmailParams[] = [];

  async send(params: SendEmailParams): Promise<void> {
    this.sent.push(params);
  }

  get lastSent(): SendEmailParams | undefined {
    return this.sent[this.sent.length - 1];
  }

  get all(): readonly SendEmailParams[] {
    return [...this.sent];
  }

  findByRecipient(email: string): SendEmailParams[] {
    const lower = email.toLowerCase();
    return this.sent.filter((s) => s.to.toLowerCase() === lower);
  }

  /** Extract the first href found in the email's text or html body. */
  extractLink(email: SendEmailParams): string | null {
    const body = email.text ?? email.html;
    if (!body) return null;
    const m = body.match(/https?:\/\/\S+/);
    return m ? m[0] : null;
  }

  /**
   * Extract a token from a verification or invitation email URL.
   * - Verification: /verificar-email/sucesso?token=...
   * - Invitation:   /convite/{token}
   */
  extractToken(email: SendEmailParams): string | null {
    const link = this.extractLink(email);
    if (!link) return null;
    const queryMatch = link.match(/[?&]token=([^&\s]+)/);
    if (queryMatch) return decodeURIComponent(queryMatch[1]);
    const pathMatch = link.match(/\/convite\/([^/?\s]+)/);
    if (pathMatch) return decodeURIComponent(pathMatch[1]);
    return null;
  }

  reset(): void {
    this.sent = [];
  }
}
