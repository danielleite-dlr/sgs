import * as webpush from 'web-push';
import { parseVapidDetails } from './web-push-credentials';

describe('parseVapidDetails', () => {
  const keys = webpush.generateVAPIDKeys();
  const subject = 'https://sgs.jessicaseixasmakeup.com.br';
  const ok = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject };

  it('aceita chaves válidas com subject https', () => {
    expect(parseVapidDetails(ok)).toEqual(ok);
  });

  it('aceita subject mailto', () => {
    const r = parseVapidDetails({ ...ok, subject: 'mailto:suporte@exemplo.com.br' });
    expect(r?.subject).toBe('mailto:suporte@exemplo.com.br');
  });

  it('devolve null quando falta qualquer uma', () => {
    expect(parseVapidDetails({ ...ok, publicKey: undefined })).toBeNull();
    expect(parseVapidDetails({ ...ok, privateKey: '' })).toBeNull();
    expect(parseVapidDetails({ ...ok, subject: undefined })).toBeNull();
  });

  it('rejeita chave pública malformada', () => {
    expect(parseVapidDetails({ ...ok, publicKey: keys.publicKey.slice(0, 86) })).toBeNull();
    expect(
      parseVapidDetails({ ...ok, publicKey: keys.publicKey.slice(0, 86) + '!' }),
    ).toBeNull();
  });

  it('rejeita chave privada fora de 43 chars', () => {
    expect(parseVapidDetails({ ...ok, privateKey: keys.privateKey + 'A' })).toBeNull();
    expect(parseVapidDetails({ ...ok, privateKey: keys.privateKey.slice(1) })).toBeNull();
  });

  it.each(['https://localhost', 'mailto:', 'http://x.com', 'ftp://x', 'mailto:semarroba'])(
    'rejeita subject %s',
    (s) => {
      expect(parseVapidDetails({ ...ok, subject: s })).toBeNull();
    },
  );

  it('nunca lança', () => {
    expect(parseVapidDetails({})).toBeNull();
    expect(parseVapidDetails(undefined as never)).toBeNull();
  });
});
