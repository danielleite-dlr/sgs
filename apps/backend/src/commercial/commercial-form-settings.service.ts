import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { CommercialError, mapCommercialError, type CommercialUserError } from './commercial-errors';

export interface UpdateCommercialFormSettingsDto {
  isActive?: boolean | null;
  defaultAssigneeMemberId?: string | null;
  clearDefaultAssignee?: boolean | null;
  successMessage?: string | null;
  consentText?: string | null;
}

const newToken = () => randomBytes(32).toString('base64url');

/** Lê (criando na primeira vez) a configuração do formulário público do salão. */
export async function ensureFormSettingsTx(tx: TenantPrismaClient, orgId: string) {
  return tx.commercialFormSettings.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, token: newToken(), isActive: false },
    update: {},
    include: {
      defaultAssignee: {
        select: { id: true, displayName: true, role: { select: { name: true } } },
      },
    },
  });
}

type SettingsRow = Awaited<ReturnType<typeof ensureFormSettingsTx>>;

function serialize(orgId: string, s: SettingsRow) {
  return {
    isActive: s.isActive,
    token: s.token,
    publicPath: `/contato/${orgId}/${s.token}`,
    defaultAssignee: s.defaultAssignee
      ? {
          id: s.defaultAssignee.id,
          displayName: s.defaultAssignee.displayName,
          roleName: s.defaultAssignee.role.name,
        }
      : null,
    successMessage: s.successMessage,
    consentText: s.consentText,
    consentTextVersion: s.consentTextVersion,
  };
}

/** 'v1' -> 'v2'; qualquer outro formato ganha o sufixo '.1'. */
function nextVersion(v: string): string {
  const m = /^v(\d+)$/.exec(v);
  return m ? `v${Number(m[1]) + 1}` : `${v}.1`;
}

@Injectable()
export class CommercialFormSettingsService {
  constructor(private readonly tenant: TenantContextService) {}

  get(orgId: string) {
    return this.tenant.runWithTenant(orgId, async (tx) =>
      serialize(orgId, await ensureFormSettingsTx(tx, orgId)),
    );
  }

  async update(orgId: string, memberId: string, input: UpdateCommercialFormSettingsDto) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await ensureFormSettingsTx(tx, orgId);
        const data: Record<string, unknown> = { updatedBy: memberId };
        if (typeof input.isActive === 'boolean') data.isActive = input.isActive;

        if (input.clearDefaultAssignee) {
          data.defaultAssigneeMemberId = null;
        } else if (input.defaultAssigneeMemberId) {
          const m = await tx.member.findFirst({
            where: {
              id: input.defaultAssigneeMemberId,
              organizationId: orgId,
              status: 'active',
              deletedAt: null,
              role: { name: { in: ['ADMIN', 'MANAGER', 'ATTENDANT'] } },
            },
          });
          if (!m) {
            throw new CommercialError(
              'ASSIGNEE_INVALID',
              'Responsável inválido: escolha um membro ativo do Comercial.',
              'defaultAssigneeMemberId',
            );
          }
          data.defaultAssigneeMemberId = m.id;
        }

        if (input.successMessage !== undefined) {
          const msg = (input.successMessage ?? '').trim();
          if (msg.length > 300) {
            throw new CommercialError(
              'MESSAGE_TOO_LONG',
              'A mensagem de sucesso aceita até 300 caracteres.',
              'successMessage',
            );
          }
          data.successMessage = msg === '' ? null : msg;
        }

        if (input.consentText !== undefined && input.consentText !== null) {
          const text = input.consentText.trim();
          if (text.length < 1 || text.length > 2000) {
            throw new CommercialError(
              'CONSENT_TEXT_INVALID',
              'O texto de consentimento deve ter de 1 a 2000 caracteres.',
              'consentText',
            );
          }
          if (text !== cur.consentText) {
            data.consentText = text;
            data.consentTextVersion = nextVersion(cur.consentTextVersion);
          }
        }

        await tx.commercialFormSettings.update({ where: { id: cur.id }, data });
        const fresh = await ensureFormSettingsTx(tx, orgId);
        return { settings: serialize(orgId, fresh), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      const m = mapCommercialError(e);
      if (!m) throw e;
      return { settings: null, errors: [m] };
    }
  }

  /** O token antigo deixa de valer na hora (a rota pública compara com o gravado). */
  async regenerate(orgId: string, memberId: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const cur = await ensureFormSettingsTx(tx, orgId);
      await tx.commercialFormSettings.update({
        where: { id: cur.id },
        data: { token: newToken(), updatedBy: memberId },
      });
      const fresh = await ensureFormSettingsTx(tx, orgId);
      return { settings: serialize(orgId, fresh), errors: [] as CommercialUserError[] };
    });
  }
}
