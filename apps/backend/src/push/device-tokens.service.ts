import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../database/tenant-context.service';

export interface RegisterDeviceTokenInput {
  token: string;
  platform: string;
  provider?: string | null;
  appVersion?: string | null;
}

// Cópia de packages/shared/src/validation.ts — Docker do staging não enxerga o workspace (07-RESEARCH Pitfall 1).
const DEVICE_PLATFORMS = ['android', 'ios'];
const PUSH_PROVIDERS = ['fcm', 'expo'];
const MAX_DEVICE_TOKEN_LENGTH = 4096;
const MAX_APP_VERSION_LENGTH = 20;

export function validateDeviceTokenInput(
  input: RegisterDeviceTokenInput,
): { field: string; message: string } | null {
  if (
    input.token.trim().length === 0 ||
    input.token.length > MAX_DEVICE_TOKEN_LENGTH
  ) {
    return { field: 'token', message: 'Token do aparelho inválido.' };
  }
  if (!DEVICE_PLATFORMS.includes(input.platform)) {
    return { field: 'platform', message: 'Plataforma inválida.' };
  }
  if (!PUSH_PROVIDERS.includes(input.provider ?? 'fcm')) {
    return { field: 'provider', message: 'Provedor de push inválido.' };
  }
  if (
    input.appVersion != null &&
    input.appVersion.length > MAX_APP_VERSION_LENGTH
  ) {
    return { field: 'appVersion', message: 'Versão do app inválida.' };
  }
  return null;
}

@Injectable()
export class DeviceTokensService {
  constructor(private readonly tenant: TenantContextService) {}

  /**
   * Registra o token do aparelho para a usuária. Se o mesmo token estava com
   * outra usuária do salão (aparelho compartilhado), ele é movido: a anterior
   * deixa de receber push nesse aparelho.
   */
  async register(
    orgId: string,
    memberId: string,
    input: RegisterDeviceTokenInput,
  ): Promise<boolean> {
    const err = validateDeviceTokenInput(input);
    if (err) throw new BadRequestException(err.message);
    const provider = input.provider ?? 'fcm';
    const appVersion = input.appVersion ?? null;

    await this.tenant.runWithTenant(orgId, async (tx) => {
      await tx.deviceToken.deleteMany({
        where: { provider, token: input.token, memberId: { not: memberId } },
      });
      await tx.deviceToken.upsert({
        where: {
          uq_device_tokens_org_provider_token: {
            organizationId: orgId,
            provider,
            token: input.token,
          },
        },
        create: {
          organizationId: orgId,
          memberId,
          provider,
          platform: input.platform,
          token: input.token,
          appVersion,
        },
        update: {
          memberId,
          platform: input.platform,
          appVersion,
          lastSeenAt: new Date(),
        },
      });
    });
    return true;
  }

  async unregister(
    orgId: string,
    memberId: string,
    token: string,
  ): Promise<boolean> {
    if (token.trim().length === 0) return false;
    await this.tenant.runWithTenant(orgId, async (tx) => {
      await tx.deviceToken.deleteMany({ where: { token, memberId } });
    });
    return true;
  }
}
