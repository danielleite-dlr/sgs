import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = join(__dirname, '../..');
const publico = (p: string) => join(raiz, 'public', p);
const manifest = JSON.parse(readFileSync(publico('manifest.webmanifest'), 'utf8'));
const html = readFileSync(join(raiz, 'index.html'), 'utf8');

function ihdr(arquivo: string) {
  const b = readFileSync(publico(arquivo));
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), tipoCor: b[25] };
}

describe('manifest do Gestor Beauty', () => {
  it('declara o app instalável', () => {
    expect(manifest).toMatchObject({
      id: '/',
      name: 'Gestor Beauty',
      short_name: 'Gestor Beauty',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#570080',
      background_color: '#F7F6F3',
      lang: 'pt-BR',
    });
  });

  it('todos os ícones existem e têm as dimensões declaradas', () => {
    for (const icon of manifest.icons) {
      const arquivo = icon.src.replace(/^\//, '');
      expect(existsSync(publico(arquivo)), icon.src).toBe(true);
      const [l, a] = icon.sizes.split('x').map(Number);
      const dim = ihdr(arquivo);
      expect([dim.largura, dim.altura]).toEqual([l, a]);
    }
  });

  it('tem 192 e 512 any e 512 maskable', () => {
    const tem = (sizes: string, purpose: string) =>
      manifest.icons.some((i: { sizes: string; purpose: string }) => i.sizes === sizes && i.purpose === purpose);
    expect(tem('192x192', 'any')).toBe(true);
    expect(tem('512x512', 'any')).toBe(true);
    expect(tem('512x512', 'maskable')).toBe(true);
  });

  it('apple-touch-icon é 180x180 RGB sem transparência', () => {
    const d = ihdr('icons/apple-touch-icon-180.png');
    expect([d.largura, d.altura, d.tipoCor]).toEqual([180, 180, 2]);
  });
});

describe('index.html do app instalável', () => {
  it('liga manifest, ícone e metas do iOS', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Gestor Beauty"');
    expect(html).toContain('name="theme-color" content="#7E22CE"');
    expect(html).toContain('viewport-fit=cover');
  });
});
