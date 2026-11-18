import { timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUuid, TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { isDealKind } from './commercial-constants';
import { findDuplicatesTx } from './commercial-leads.service';
import { phoneDigits } from './commercial-phone';
import { ensureDefaultStagesTx } from './commercial-stages.service';

const DEFAULT_SUCCESS = 'Recebemos seu contato. Em breve falaremos com você.';
const REPEAT_NOTE = 'Novo envio pelo formulário do site';
const REPEAT_WINDOW_MS = 30 * 60_000;

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Formulário não encontrado.' });
const bad = (code: string, message: string) => new BadRequestException({ code, message });

function tokenMatches(given: unknown, stored: string, active: boolean): boolean {
  const a = Buffer.from(typeof given === 'string' ? given : '', 'utf8');
  const b = Buffer.from(stored, 'utf8');
  // tamanho diferente = falha (timingSafeEqual exige buffers do mesmo tamanho)
  const same = a.length === b.length && timingSafeEqual(a, b);
  return same && active;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

@Injectable()
export class PublicLeadService {
  constructor(private readonly tenant: TenantContextService) {}

  /** Carrega as configurações no tenant da URL; qualquer falha vira o mesmo 404. */
  private async load(tx: TenantPrismaClient, orgId: string, token: string) {
    const rows = await tx.commercialFormSettings.findMany({ where: { organizationId: orgId } });
    const s = rows[0];
    if (!s || !tokenMatches(token, s.token, s.isActive)) throw notFound();
    return s;
  }

  async view(orgId: string, token: string) {
    if (!isUuid(orgId)) throw notFound();
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const s = await this.load(tx, orgId, token);
      const org = await tx.$queryRaw<{ trade_name: string }[]>`
        SELECT trade_name FROM organizations WHERE id = ${orgId}::uuid`;
      return {
        orgName: org[0]?.trade_name ?? '',
        consentText: s.consentText,
        consentTextVersion: s.consentTextVersion,
        successMessage: s.successMessage,
      };
    });
  }

  /** Não loga corpo nem IP: telefone e e-mail do visitante nunca vão para o log. */
  async submit(orgId: string, token: string, body: unknown) {
    if (!isUuid(orgId)) throw notFound();
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const settings = await this.load(tx, orgId, token);
      const message = settings.successMessage ?? DEFAULT_SUCCESS;

      // honeypot: robôs preenchem; responde ok sem gravar
      if (str(b.website) !== '') return { ok: true, message };

      if (b.consent !== true) {
        throw bad('CONSENT_REQUIRED', 'É preciso concordar com o uso dos dados para enviar.');
      }
      const fullName = str(b.fullName);
      if (fullName.length < 2 || fullName.length > 120) {
        throw bad('NAME_INVALID', 'Informe seu nome (de 2 a 120 caracteres).');
      }
      const phone = str(b.phone);
      if (phoneDigits(phone) === null) {
        throw bad('PHONE_INVALID', 'Telefone inválido: informe DDD e número.');
      }
      const email = str(b.email).toLowerCase();
      if (email !== '' && (email.length > 255 || !/^[^\s@]+@[^\s@]+$/.test(email))) {
        throw bad('EMAIL_INVALID', 'E-mail inválido.');
      }
      if (!isDealKind(b.kind)) throw bad('KIND_INVALID', 'Escolha noiva ou debutante.');
      const kind = b.kind;
      const note = str(b.message);
      if (note.length > 1000) {
        throw bad('MESSAGE_TOO_LONG', 'A mensagem aceita até 1000 caracteres.');
      }
      let eventDate: Date | null = null;
      const dateText = str(b.eventDate);
      if (dateText !== '') {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
        const d = m ? new Date(`${dateText}T00:00:00.000Z`) : null;
        if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dateText) {
          throw bad('DATE_INVALID', 'Data do evento inválida.');
        }
        eventDate = d;
      }

      // serializa envios do mesmo telefone na mesma org
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`public_lead:${orgId}:${phoneDigits(phone)}`}))`;
      const dup = await findDuplicatesTx(tx, { phone, email: email || null });
      const existing =
        dup.leads.length > 0
          ? await tx.commercialLead.findMany({
              where: { id: { in: dup.leads.map((l) => l.id) }, deletedAt: null },
              orderBy: { createdAt: 'asc' },
            })
          : [];
      const lead0 = existing[0] ?? null;

      if (lead0) {
        const since = new Date(Date.now() - REPEAT_WINDOW_MS);
        const recentSend =
          lead0.source === 'site' &&
          (lead0.createdAt > since ||
            (await tx.commercialInteraction.count({
              where: { leadId: lead0.id, notes: REPEAT_NOTE, createdAt: { gt: since } },
            })) > 0);
        await tx.commercialInteraction.create({
          data: { organizationId: orgId, leadId: lead0.id, type: 'other', notes: REPEAT_NOTE },
        });
        if (recentSend) return { ok: true, message };
        if (!lead0.consentAt) {
          await tx.commercialLead.update({
            where: { id: lead0.id },
            data: { consentAt: new Date(), consentTextVersion: settings.consentTextVersion },
          });
        }
        const openSame = await tx.commercialDeal.count({
          where: { leadId: lead0.id, status: 'open', kind, deletedAt: null },
        });
        if (openSame === 0) {
          await this.createDeal(tx, orgId, lead0.id, kind, eventDate, note, settings);
        }
        return { ok: true, message };
      }

      const lead = await tx.commercialLead.create({
        data: {
          organizationId: orgId,
          fullName,
          phone: phone.slice(0, 30),
          phoneDigits: phoneDigits(phone),
          email: email || null,
          source: 'site',
          clientId: dup.clients[0]?.id ?? null,
          createdBy: null,
          consentAt: new Date(),
          consentTextVersion: settings.consentTextVersion,
        },
      });
      await this.createDeal(tx, orgId, lead.id, kind, eventDate, note, settings);
      return { ok: true, message };
    });
  }

  private async createDeal(
    tx: TenantPrismaClient,
    orgId: string,
    leadId: string,
    kind: string,
    eventDate: Date | null,
    note: string,
    settings: { defaultAssigneeMemberId: string | null },
  ) {
    await ensureDefaultStagesTx(tx, orgId);
    const first = await tx.commercialStage.findFirst({
      where: { organizationId: orgId, kind: 'open' },
      orderBy: { position: 'asc' },
    });
    if (!first) return;
    let assignee: string | null = null;
    if (settings.defaultAssigneeMemberId) {
      const m = await tx.member.findFirst({
        where: {
          id: settings.defaultAssigneeMemberId,
          organizationId: orgId,
          status: 'active',
          deletedAt: null,
        },
        select: { id: true },
      });
      assignee = m?.id ?? null;
    }
    await tx.commercialDeal.create({
      data: {
        organizationId: orgId,
        leadId,
        stageId: first.id,
        kind,
        eventDate,
        source: 'site',
        notes: note === '' ? null : note,
        assigneeMemberId: assignee,
        createdBy: null,
      },
    });
  }
}
