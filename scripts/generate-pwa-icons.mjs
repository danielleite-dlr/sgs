// Gera os ícones do app instalável (fase 8) a partir de apps/mobile/assets/icon-only.png.
// Uso: node scripts/generate-pwa-icons.mjs (na raiz do repo). Usa o sharp já instalado no pnpm.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const dir = fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find((d) => d.startsWith('sharp@'));
if (!dir) throw new Error('sharp não encontrado em node_modules/.pnpm');
const require = createRequire(import.meta.url);
const sharp = require(path.join(root, 'node_modules/.pnpm', dir, 'node_modules/sharp/dist/index.cjs'));

const BG = '#570080';
const src = path.join(root, 'apps/mobile/assets/icon-only.png');
const out = path.join(root, 'apps/frontend/public/icons');
fs.mkdirSync(out, { recursive: true });

// iOS pinta transparência de preto: o apple-touch-icon sai sem canal alfa.
await sharp(src)
  .resize(180, 180)
  .flatten({ background: BG })
  .removeAlpha()
  .png()
  .toFile(path.join(out, 'apple-touch-icon-180.png'));

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  // A arte já é fundo roxo de ponta a ponta, com "GB" dentro da área segura de 80%.
  ['icon-512-maskable.png', 512],
]) {
  await sharp(src).resize(size, size).flatten({ background: BG }).png().toFile(path.join(out, name));
}
console.log('Ícones gerados em', out);
