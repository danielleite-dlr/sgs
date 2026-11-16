import { BadRequestException } from '@nestjs/common';
import {
  DeviceTokensService,
  validateDeviceTokenInput,
} from './device-tokens.service';

describe('validateDeviceTokenInput', () => {
  const ok = { token: 'abc', platform: 'android' };
  it('aceita entrada válida', () => {
    expect(validateDeviceTokenInput(ok)).toBeNull();
    expect(
      validateDeviceTokenInput({ ...ok, provider: 'fcm', appVersion: '1.0.0' }),
    ).toBeNull();
  });
  it('rejeita token vazio ou grande demais', () => {
    expect(validateDeviceTokenInput({ ...ok, token: '  ' })?.field).toBe(
      'token',
    );
    expect(
      validateDeviceTokenInput({ ...ok, token: 'x'.repeat(4097) })?.message,
    ).toBe('Token do aparelho inválido.');
  });
  it('rejeita plataforma, provedor e versão inválidos', () => {
    expect(validateDeviceTokenInput({ ...ok, platform: 'web' })?.message).toBe(
      'Plataforma inválida.',
    );
    expect(validateDeviceTokenInput({ ...ok, provider: 'apns' })?.message).toBe(
      'Provedor de push inválido.',
    );
    expect(
      validateDeviceTokenInput({ ...ok, appVersion: 'v'.repeat(21) })?.message,
    ).toBe('Versão do app inválida.');
  });
});

describe('DeviceTokensService', () => {
  const tx = {
    deviceToken: { deleteMany: jest.fn(), upsert: jest.fn() },
  };
  const tenant = {
    runWithTenant: jest.fn((_org: string, fn: (t: typeof tx) => unknown) =>
      fn(tx),
    ),
  };
  let svc: DeviceTokensService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new DeviceTokensService(tenant as never);
  });

  it('register: apaga o token de outras usuárias antes do upsert', async () => {
    const r = await svc.register('org', 'm1', {
      token: 'tok',
      platform: 'android',
      appVersion: '1.2.3',
    });
    expect(r).toBe(true);
    expect(tx.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { provider: 'fcm', token: 'tok', memberId: { not: 'm1' } },
    });
    const upsertArg = tx.deviceToken.upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({
      uq_device_tokens_org_provider_token: {
        organizationId: 'org',
        provider: 'fcm',
        token: 'tok',
      },
    });
    expect(upsertArg.update).toMatchObject({
      memberId: 'm1',
      platform: 'android',
      appVersion: '1.2.3',
    });
    expect(upsertArg.update.lastSeenAt).toBeInstanceOf(Date);
    expect(tx.deviceToken.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.deviceToken.upsert.mock.invocationCallOrder[0],
    );
  });

  it('register: entrada inválida lança BadRequestException em pt-BR', async () => {
    await expect(
      svc.register('org', 'm1', { token: 't', platform: 'web' }),
    ).rejects.toThrow(new BadRequestException('Plataforma inválida.'));
    expect(tenant.runWithTenant).not.toHaveBeenCalled();
  });

  it('unregister: remove só o token da própria usuária', async () => {
    expect(await svc.unregister('org', 'm1', 'tok')).toBe(true);
    expect(tx.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'tok', memberId: 'm1' },
    });
  });

  it('unregister: token vazio devolve false sem tocar no banco', async () => {
    expect(await svc.unregister('org', 'm1', ' ')).toBe(false);
    expect(tenant.runWithTenant).not.toHaveBeenCalled();
  });
});
