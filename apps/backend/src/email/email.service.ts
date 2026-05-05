import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendAdapter } from './resend.adapter';
import type { Env } from '../config/env.schema';

/**
 * EmailService — composed messaging API for SGS transactional emails.
 * Delegates to ResendAdapter for actual delivery.
 */
@Injectable()
export class EmailService {
  constructor(
    private readonly resend: ResendAdapter,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async sendVerification(
    to: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    const appUrl = this.config.get('FRONTEND_URL', { infer: true });
    const link = `${appUrl}/verificar-email/sucesso?token=${encodeURIComponent(token)}`;
    await this.resend.send({
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
    await this.resend.send({
      to,
      subject: `Convite para ${salonName} — SGS`,
      html: `<p>${inviterName} convidou você para entrar na equipe de ${salonName}.</p>
             <p><a href="${link}">Aceitar convite</a></p>`,
      text: `${inviterName} convidou você para ${salonName}. Aceitar: ${link}`,
    });
  }
}
