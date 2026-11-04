import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeCpf, validateCpf } from '../../clients/cpf.util';
import { recordAudit } from '../../common/audit-log';
import { isUuid, TenantContextService } from '../../database/tenant-context.service';
import type { TenantPrismaClient } from '../../database/types';
import { lockContract } from '../contract-lock';
import { maskCpf } from '../domain/contract-template';
import { hashToken } from '../domain/contract-token';

const NOT_FOUND_MESSAGE = 'Link inválido ou expirado.';

export interface AcceptBody {
  fullName?: unknown;
  cpf?: unknown;
  accepted?: unknown;
  textSha256?: unknown;
}

export interface AcceptMeta {
  ip: string;
  userAgent: string | null;
}

export interface PublicContractView {
  orgName: string;
  code: string;
  eventDate: string;
  version: number;
  text: string;
  textSha256: string;
  accepted: boolean;
  acceptedAt: string | null;
  acceptedName: string | null;
  isCurrentVersion: boolean;
  expiresAt: string;
}

export interface ContractPdfData {
  orgName: string;
  code: string;
  text: string;
  version: number;
  notice: string | null;
  acceptance: {
    name: string;
    cpfMasked: string;
    acceptedAtLocal: string;
    ip: string;
    sha256: string;
    version: number;
  } | null;
}

interface TokenRow {
  version_id: string;
  expires_at: Date;
  contract_id: string;
  code: string;
  current_version: number;
  bridal_group_id: string;
  bride_client_id: string;
  version: number;
  rendered_text: string;
  text_sha256: string;
}

export function userError(status: HttpStatus, code: string, message: string): HttpException {
  return new HttpException({ code, message }, status);
}

/** Data e hora local (dd/MM/yyyy HH:mm) no fuso informado. */
export function formatLocalDateTime(d: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

@Injectable()
export class ContractAcceptanceService {
  constructor(private readonly tenant: TenantContextService) {}

  private notFound(): NotFoundException {
    return new NotFoundException({ code: 'NOT_FOUND', message: NOT_FOUND_MESSAGE });
  }

  /** Resolve o token (hash) dentro do tenant; qualquer falha vira o mesmo 404 (sem oráculo). */
  private async findToken(tx: TenantPrismaClient, token: string): Promise<TokenRow> {
    if (typeof token !== 'string' || token.length < 16 || token.length > 128) {
      throw this.notFound();
    }
    const rows = await tx.$queryRaw<TokenRow[]>`
      SELECT t.version_id, t.expires_at, c.id AS contract_id, c.code, c.current_version,
             c.bridal_group_id, c.bride_client_id, v.version, v.rendered_text, v.text_sha256
        FROM contract_access_tokens t
        JOIN contracts c ON c.id = t.contract_id
        JOIN contract_versions v ON v.id = t.version_id
       WHERE t.token_hash = ${hashToken(token)}
         AND t.revoked_at IS NULL
         AND t.expires_at > now()
         AND c.status <> 'cancelled'`;
    const row = rows[0];
    if (!row) throw this.notFound();
    return row;
  }

  private async orgInfo(tx: TenantPrismaClient, orgId: string) {
    const rows = await tx.$queryRaw<{ trade_name: string; timezone: string }[]>`
      SELECT trade_name, timezone FROM organizations WHERE id = ${orgId}::uuid`;
    return { name: rows[0]?.trade_name ?? '', timezone: rows[0]?.timezone ?? 'America/Sao_Paulo' };
  }

  private async eventDate(tx: TenantPrismaClient, groupId: string): Promise<string> {
    const g = await tx.bridalGroup.findUnique({
      where: { id: groupId },
      select: { eventDate: true },
    });
    return g ? g.eventDate.toISOString().slice(0, 10) : '';
  }

  async view(orgId: string, token: string): Promise<PublicContractView> {
    if (!isUuid(orgId)) throw this.notFound();
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const t = await this.findToken(tx, token);
      if (t.version !== t.current_version) throw this.notFound();
      const org = await this.orgInfo(tx, orgId);
      const acc = await tx.contractAcceptance.findUnique({ where: { versionId: t.version_id } });
      return {
        orgName: org.name,
        code: t.code,
        eventDate: await this.eventDate(tx, t.bridal_group_id),
        version: t.version,
        text: t.rendered_text,
        textSha256: t.text_sha256,
        accepted: !!acc,
        acceptedAt: acc ? acc.acceptedAt.toISOString() : null,
        acceptedName: acc ? acc.acceptedName : null,
        isCurrentVersion: true,
        expiresAt: t.expires_at.toISOString(),
      };
    });
  }

  async accept(
    orgId: string,
    token: string,
    body: AcceptBody,
    meta: AcceptMeta,
  ): Promise<{ accepted: true; acceptedAt: string }> {
    if (!isUuid(orgId)) throw this.notFound();
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
    if (fullName.length < 3 || fullName.length > 255) {
      throw userError(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_NAME', 'Informe seu nome completo.');
    }
    const cpfInput = typeof body?.cpf === 'string' ? body.cpf : '';
    if (!validateCpf(cpfInput)) {
      throw userError(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_CPF', 'CPF inválido.');
    }
    if (body?.accepted !== true) {
      throw userError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'NOT_ACCEPTED',
        'É necessário aceitar os termos do contrato.',
      );
    }
    const cpf = normalizeCpf(cpfInput);
    const textSha256 = typeof body?.textSha256 === 'string' ? body.textSha256 : '';

    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const t = await this.findToken(tx, token);
        const locked = await lockContract(tx, t.contract_id);
        if (t.version !== locked.current_version) throw this.notFound();
        if (textSha256 !== t.text_sha256) {
          throw userError(
            HttpStatus.CONFLICT,
            'TEXT_CHANGED',
            'O contrato foi atualizado. Recarregue a página para ler a nova versão.',
          );
        }
        const existing = await tx.contractAcceptance.findUnique({
          where: { versionId: t.version_id },
          select: { id: true },
        });
        if (existing) {
          throw userError(HttpStatus.CONFLICT, 'ALREADY_ACCEPTED', 'Este contrato já foi aceito.');
        }
        const bride = await tx.client.findUnique({
          where: { id: t.bride_client_id },
          select: { cpf: true },
        });
        const registered = bride?.cpf ? normalizeCpf(bride.cpf) : '';
        if (registered && registered !== cpf) {
          throw userError(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'CPF_MISMATCH',
            'O CPF informado não confere com o cadastro da contratante.',
          );
        }
        const acceptance = await tx.contractAcceptance.create({
          data: {
            organizationId: orgId,
            contractId: t.contract_id,
            versionId: t.version_id,
            acceptedName: fullName,
            acceptedCpf: cpf,
            ip: meta.ip.slice(0, 45),
            userAgent: meta.userAgent ? meta.userAgent.slice(0, 1000) : null,
            textSha256: t.text_sha256,
          },
        });
        await tx.contract.update({
          where: { id: t.contract_id },
          data: {
            status: 'active',
            acceptedVersion: locked.current_version,
            acceptedAt: acceptance.acceptedAt,
          },
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: null,
          action: 'contract.accept',
          entityType: 'contract',
          entityId: t.contract_id,
          metadata: { version: t.version, ip: meta.ip },
        });
        return { accepted: true as const, acceptedAt: acceptance.acceptedAt.toISOString() };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw userError(HttpStatus.CONFLICT, 'ALREADY_ACCEPTED', 'Este contrato já foi aceito.');
      }
      throw e;
    }
  }

  /** Dados do PDF para o link público: só existe após o aceite da versão do token. */
  async pdfDataForToken(orgId: string, token: string): Promise<ContractPdfData> {
    if (!isUuid(orgId)) throw this.notFound();
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const t = await this.findToken(tx, token);
      const data = await this.buildPdfData(tx, orgId, t.contract_id, t.version_id);
      if (!data || !data.acceptance) throw this.notFound();
      return data;
    });
  }

  /** Dados do PDF para o dono: versão aceita do contrato (null se nunca aceito). */
  async pdfDataForOwner(orgId: string, contractId: string): Promise<ContractPdfData | null> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const c = await tx.contract.findUnique({
        where: { id: contractId },
        select: { acceptedVersion: true, currentVersion: true },
      });
      if (!c || c.acceptedVersion == null) return null;
      const v = await tx.contractVersion.findUnique({
        where: { uq_cv_contract_version: { contractId, version: c.acceptedVersion } },
        select: { id: true },
      });
      if (!v) return null;
      const data = await this.buildPdfData(tx, orgId, contractId, v.id);
      if (!data) return null;
      if (c.acceptedVersion !== c.currentVersion) {
        data.notice = `Versão aceita v${c.acceptedVersion}. O contrato possui alterações posteriores ainda não aceitas.`;
      }
      return data;
    });
  }

  private async buildPdfData(
    tx: TenantPrismaClient,
    orgId: string,
    contractId: string,
    versionId: string,
  ): Promise<ContractPdfData | null> {
    const v = await tx.contractVersion.findUnique({ where: { id: versionId } });
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      select: { code: true },
    });
    if (!v || !contract) return null;
    const org = await this.orgInfo(tx, orgId);
    const acc = await tx.contractAcceptance.findUnique({ where: { versionId } });
    return {
      orgName: org.name,
      code: contract.code,
      text: v.renderedText,
      version: v.version,
      notice: null,
      acceptance: acc
        ? {
            name: acc.acceptedName,
            cpfMasked: maskCpf(acc.acceptedCpf),
            acceptedAtLocal: formatLocalDateTime(acc.acceptedAt, org.timezone),
            ip: acc.ip,
            sha256: acc.textSha256,
            version: v.version,
          }
        : null,
    };
  }
}
