// Gera os PNGs-fonte (ícone, ícone adaptativo e splash) a partir dos SVGs da marca Gestor Beauty.
// Origem: docs/marca/gestor-beauty/svg (copiados para assets/):
//   icon.svg                         = icone-app.svg (quadrado roxo vivo com o símbolo branco)
//   simbolo-branco.svg               = camada do ícone adaptativo
//   logo-vertical-principal.svg      = splash claro
//   logo-vertical-fundo-escuro.svg   = splash escuro
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(raiz, 'assets');

const ROXO_VIVO = '#A855F7';
const ROXO_ESCURO = '#250B42';
const PAPEL = '#F7F6F3';

const fonte = (nome) => {
  const caminho = path.join(assets, nome);
  if (!existsSync(caminho)) {
    throw new Error(`render-assets: ${nome} não encontrado em assets/ (copie de docs/marca/gestor-beauty/svg)`);
  }
  return caminho;
};
const saida = (nome) => path.join(assets, nome);

// Renderiza um SVG com a largura pedida, com densidade alta para não borrar.
async function renderizar(arquivo, largura) {
  return sharp(fonte(arquivo), { density: 600 })
    .resize({ width: largura })
    .png()
    .toBuffer();
}

await sharp(fonte('icon.svg'), { density: 600 })
  .resize(1024, 1024)
  .png()
  .toFile(saida('icon-only.png'));

await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: ROXO_VIVO },
})
  .png()
  .toFile(saida('icon-background.png'));

// Ícone adaptativo: símbolo branco (~40% do canvas) no centro, dentro da zona segura.
const simbolo = await renderizar('simbolo-branco.svg', 410);
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: simbolo, gravity: 'center' }])
  .png()
  .toFile(saida('icon-foreground.png'));

// Splash: logo vertical (~900 px) centralizado, claro e escuro.
const splashes = [
  ['splash.png', 'logo-vertical-principal.svg', PAPEL],
  ['splash-dark.png', 'logo-vertical-fundo-escuro.svg', ROXO_ESCURO],
];
for (const [nome, logo, fundo] of splashes) {
  const logoPng = await renderizar(logo, 900);
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: fundo } })
    .composite([{ input: logoPng, gravity: 'center' }])
    .png()
    .toFile(saida(nome));
}
console.log('render-assets: PNGs gerados em assets/');
