import { describe, expect, it } from 'vitest';
import { validateDeviceTokenInput } from '../validation';

describe('validateDeviceTokenInput', () => {
  it('rejeita token vazio', () => {
    expect(validateDeviceTokenInput({ token: '', platform: 'android' })).toEqual({
      field: 'token',
      message: 'Token do aparelho inválido.',
    });
  });
  it('rejeita token longo demais', () => {
    expect(validateDeviceTokenInput({ token: 'a'.repeat(4097), platform: 'android' })?.field).toBe('token');
  });
  it('rejeita plataforma inválida', () => {
    expect(validateDeviceTokenInput({ token: 'abc', platform: 'web' })?.field).toBe('platform');
  });
  it('rejeita provedor inválido', () => {
    expect(validateDeviceTokenInput({ token: 'abc', platform: 'android', provider: 'apns' })?.field).toBe('provider');
  });
  it('rejeita versão do app longa demais', () => {
    expect(validateDeviceTokenInput({ token: 'abc', platform: 'android', appVersion: 'x'.repeat(21) })?.field).toBe('appVersion');
  });
  it('aceita entrada válida', () => {
    expect(validateDeviceTokenInput({ token: 'abc', platform: 'android' })).toBeNull();
  });
});
