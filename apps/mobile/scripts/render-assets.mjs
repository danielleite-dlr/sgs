// Gera os PNGs-fonte (ícone, ícone adaptativo e splash) a partir de assets/icon.svg.
// O SVG é a única fonte da verdade; as variações são feitas por substituição de texto.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(raiz, 'assets');
const svg = readFileSync(path.join(assets, 'icon.svg'), 'utf8');

const ROXO = '#570080';
const PAPEL = '#F7F6F3';

// Ícone adaptativo: fundo transparente e texto menor (zona segura central de 66%).
const svgForeground = svg.replace(/<rect[^>]*\/>\s*/, '').replace('font-size="400"', 'font-size="300"');
if (svgForeground === svg) throw new Error('icon.svg fora do formato esperado');

const saida = (nome) => path.join(assets, nome);

const iconOnly = await sharp(Buffer.from(svg)).resize(1024, 1024).png().toBuffer();
await sharp(iconOnly).toFile(saida('icon-only.png'));

await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: ROXO },
})
  .png()
  .toFile(saida('icon-background.png'));

await sharp(Buffer.from(svgForeground)).resize(1024, 1024).png().toFile(saida('icon-foreground.png'));

// Splash: papel com o ícone 512x512 de cantos arredondados no centro.
const mascara = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="112" ry="112" fill="#fff"/></svg>',
);
const iconeRedondo = await sharp(iconOnly)
  .resize(512, 512)
  .composite([{ input: mascara, blend: 'dest-in' }])
  .png()
  .toBuffer();

for (const nome of ['splash.png', 'splash-dark.png']) {
  await sharp({
    create: { width: 2732, height: 2732, channels: 4, background: PAPEL },
  })
    .composite([{ input: iconeRedondo, gravity: 'center' }])
    .png()
    .toFile(saida(nome));
}
console.log('render-assets: PNGs gerados em assets/');
