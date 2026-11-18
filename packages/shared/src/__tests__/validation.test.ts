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

  describe('webpush', () => {
    const ep = 'https://web.push.apple.com/QKfake-endpoint-p8';
    const p256dh = 'B' + 'a'.repeat(86);
    const auth = 'c'.repeat(22);
    const ok = { token: ep, platform: 'ios', provider: 'webpush', p256dh, auth };
    it('aceita inscrição válida', () => {
      expect(validateDeviceTokenInput(ok)).toBeNull();
    });
    it('rejeita plataforma android', () => {
      expect(validateDeviceTokenInput({ ...ok, platform: 'android' })?.field).toBe('platform');
    });
    it.each([
      'http://web.push.apple.com/x',
      'https://127.0.0.1/x',
      'https://evil.com/x',
      'https://web.push.apple.com.evil.com/x',
      'https://user:pw@web.push.apple.com/x',
      'https://web.push.apple.com:8443/x',
      'https://web.push.apple.com/' + 'a'.repeat(2030),
      'isto nao e url',
    ])('rejeita endpoint %s', (token) => {
      expect(validateDeviceTokenInput({ ...ok, token })?.field).toBe('token');
    });
    it('rejeita chaves ausentes ou malformadas', () => {
      expect(validateDeviceTokenInput({ ...ok, p256dh: undefined })?.field).toBe('p256dh');
      expect(validateDeviceTokenInput({ ...ok, auth: undefined })?.field).toBe('auth');
      expect(validateDeviceTokenInput({ ...ok, p256dh: 'a'.repeat(86) })?.field).toBe('p256dh');
      expect(validateDeviceTokenInput({ ...ok, auth: 'c'.repeat(21) + '+' })?.field).toBe('auth');
    });
    it('fcm continua sem exigir chaves', () => {
      expect(validateDeviceTokenInput({ token: 'abc', platform: 'android', provider: 'fcm' })).toBeNull();
    });
  });
});
