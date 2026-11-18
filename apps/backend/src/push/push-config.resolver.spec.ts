import type { AppConfigService } from '../config/app-config.service';
import { PushConfigResolver } from './push-config.resolver';

const build = (vapid: unknown) =>
  new PushConfigResolver({ vapid } as unknown as AppConfigService);

describe('PushConfigResolver', () => {
  it('sem VAPID devolve webPushPublicKey null', () => {
    expect(build(null).pushConfig()).toEqual({ webPushPublicKey: null });
  });

  it('com VAPID devolve só a chave pública', () => {
    const res = build({
      publicKey: 'P',
      privateKey: 'SEGREDO',
      subject: 'https://x',
    }).pushConfig();
    expect(res).toEqual({ webPushPublicKey: 'P' });
    expect(JSON.stringify(res)).not.toContain('SEGREDO');
    expect(JSON.stringify(res)).not.toContain('https://x');
  });
});
