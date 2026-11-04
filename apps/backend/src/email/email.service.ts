import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_ADAPTER } from './email.tokens';
import type { EmailAdapter } from './resend.adapter';
import type { Env } from '../config/env.schema';

/**
 * EmailService — composed messaging API for SGS transactional emails.
 * Delegates to the EMAIL_ADAPTER token (ResendAdapter in production,
 * TestEmailAdapter in integration tests).
 */
@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_ADAPTER) private readonly adapter: EmailAdapter,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async sendVerification(
    to: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    const appUrl = this.config.get('FRONTEND_URL', { infer: true });
    const link = `${appUrl}/verificar-email/sucesso?token=${encodeURIComponent(token)}`;
    await this.adapter.send({
      to,
      subject: 'Verifique seu e-mail — SGS',
      html: `<p>Olá, ${fullName},</p>
             <p>Confirme seu e-mail clicando no link abaixo:</p>
             <p><a href="${link}">Verificar minha conta</a></p>
             <p>O link expira em 24 horas.</p>`,
      text: `Olá, ${fullName}. Verifique seu e-mail acessando: ${link}\n\nO link expira em 24 horas.`,
    });
  }

  async sendInvitation(
    to: string,
    salonName: string,
    inviterName: string,
    token: string,
  ): Promise<void> {
    const appUrl = this.config.get('FRONTEND_URL', { infer: true });
    const link = `${appUrl}/convite/${encodeURIComponent(token)}`;
    await this.adapter.send({
      to,
      subject: `Convite para ${salonName} — SGS`,
      html: `<p>${inviterName} convidou você para entrar na equipe de ${salonName}.</p>
             <p><a href="${link}">Aceitar convite</a></p>`,
      text: `${inviterName} convidou você para ${salonName}. Aceitar: ${link}`,
    });
  }

  async sendContractDigest(
    to: string,
    orgName: string,
    items: { title: string; message: string; href: string }[],
  ): Promise<void> {
    const appUrl = this.config.get('FRONTEND_URL', { infer: true });
    const li = items
      .map(
        (i) =>
          `<li><strong>${escapeHtml(i.title)}</strong><br>${escapeHtml(i.message)}<br>` +
          `<a href="${escapeHtml(`${appUrl}${i.href}`)}">Abrir</a></li>`,
      )
      .join('');
    const text = items.map((i) => `- ${i.title}: ${i.message} (${appUrl}${i.href})`).join('\n');
    await this.adapter.send({
      to,
      subject: `Pendências de contratos — ${orgName}`,
      html: `<p>Pendências abertas de contratos em ${escapeHtml(orgName)}:</p><ul>${li}</ul>`,
      text: `Pendências abertas de contratos em ${orgName}:\n${text}`,
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
