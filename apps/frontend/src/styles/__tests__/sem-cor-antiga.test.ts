import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Varredura do layout Gestor Beauty (fase 6, D-04, D-07, D-09, D-12): nenhum arquivo do
// frontend pode voltar a usar cor antiga, cor da paleta padrão do Tailwind, sombra ou Inter.

// Arquivos que ainda têm paleta padrão ou sombra e são refeitos num lote seguinte.
// Cada lote remove a sua entrada; o teste falha se uma entrada ficar sobrando.
const PALETA_PENDENTE: Record<string, string> = {
  'features/operations/lib/operations-labels.ts': '06-03',
  'features/bridal/pages/BridalGroupDetailPage.tsx': '06-09',
};
const SOMBRA_PENDENTE: Record<string, string> = {
  'features/operations/components/calendar/AppointmentCard.tsx': '06-03',
  'features/operations/pages/SchedulePage.tsx': '06-03',
};

const SRC = join(__dirname, '../..');

const COR_ANTIGA =
  /#1D9E75|#D85A30|#888780|#2C2C2A|#FAFAF8|#E5E3DC|#3D005A|#2B003F|#B42318|#5D54C7|#3C3489|shadow-card|text-red-600/i;
const PALETA_PADRAO =
  /\b(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
const FONTE_ANTIGA = /\bInter\b/;
// Sombras permitidas: nenhuma sombra e o contorno interno do foco de campo (D-14).
const SOMBRA_PERMITIDA = new Set(['shadow-none', 'shadow-[inset_0_0_0_0.5px_#570080]']);

function listarArquivos(dir: string): string[] {
  const arquivos: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === '__tests__' || nome === 'gql') continue;
      arquivos.push(...listarArquivos(caminho));
    } else if (/\.(ts|tsx|css)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
      arquivos.push(caminho);
    }
  }
  return arquivos;
}

// Tira os prefixos de variante (tudo até o último `:` fora de `[...]`) e o `!` inicial.
function semVariante(token: string): string {
  let profundidade = 0;
  let corte = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '[') profundidade++;
    else if (c === ']') profundidade = Math.max(0, profundidade - 1);
    else if (c === ':' && profundidade === 0) corte = i;
  }
  return token.slice(corte + 1).replace(/^!/, '');
}

function temSombra(linha: string): boolean {
  return linha
    .split(/[\s'"`{}=,]+/)
    .map(semVariante)
    .some((classe) => classe.startsWith('shadow') && !SOMBRA_PERMITIDA.has(classe));
}

type Ocorrencia = { arquivo: string; linha: number; texto: string };

function varrer(teste: (linha: string, arquivo: string) => boolean): Ocorrencia[] {
  const achados: Ocorrencia[] = [];
  for (const caminho of listarArquivos(SRC)) {
    const arquivo = relative(SRC, caminho).split('\\').join('/');
    readFileSync(caminho, 'utf8')
      .split('\n')
      .forEach((texto, i) => {
        if (teste(texto, arquivo)) achados.push({ arquivo, linha: i + 1, texto: texto.trim() });
      });
  }
  return achados;
}

const listar = (achados: Ocorrencia[]) =>
  achados.map((o) => `${o.arquivo}:${o.linha}  ${o.texto}`).join('\n');

const ehTsOuTsx = (arquivo: string) => /\.tsx?$/.test(arquivo);

describe('sem cor antiga, paleta padrão, sombra ou Inter (fase 6)', () => {
  it('nenhuma cor ou classe antiga (#1D9E75, #D85A30, shadow-card, text-red-600 etc.)', () => {
    expect(listar(varrer((linha) => COR_ANTIGA.test(linha)))).toBe('');
  });

  it('nenhuma cor da paleta padrão do Tailwind fora de PALETA_PENDENTE', () => {
    const achados = varrer(
      (linha, arquivo) => !(arquivo in PALETA_PENDENTE) && PALETA_PADRAO.test(linha),
    );
    expect(listar(achados)).toBe('');
  });

  it('nenhuma sombra fora de SOMBRA_PENDENTE (só shadow-none e o foco de campo)', () => {
    const achados = varrer(
      (linha, arquivo) => ehTsOuTsx(arquivo) && !(arquivo in SOMBRA_PENDENTE) && temSombra(linha),
    );
    expect(listar(achados)).toBe('');
  });

  it('casco sem o roxo escuro antigo como fundo (bg-primary-700) em components/layout', () => {
    const achados = varrer(
      (linha, arquivo) =>
        arquivo.startsWith('components/layout/') && /(^|[\s'"`])bg-primary-700\b/.test(linha),
    );
    expect(listar(achados)).toBe('');
  });

  it('nenhuma referência à fonte Inter', () => {
    expect(listar(varrer((linha) => FONTE_ANTIGA.test(linha)))).toBe('');
  });

  it('nenhuma entrada sobrando nas listas de exceção', () => {
    const sobrando: string[] = [];
    const conferir = (
      lista: Record<string, string>,
      nome: string,
      regra: (linha: string) => boolean,
    ) => {
      for (const [arquivo, lote] of Object.entries(lista)) {
        const caminho = join(SRC, arquivo);
        const ainda =
          existsSync(caminho) && readFileSync(caminho, 'utf8').split('\n').some(regra);
        if (!ainda) sobrando.push(`remova ${arquivo} de ${nome} (lote ${lote})`);
      }
    };
    conferir(PALETA_PENDENTE, 'PALETA_PENDENTE', (linha) => PALETA_PADRAO.test(linha));
    conferir(SOMBRA_PENDENTE, 'SOMBRA_PENDENTE', temSombra);
    expect(sobrando.join('\n')).toBe('');
  });

  it('a regra de sombra pega variantes e aceita só as permitidas', () => {
    expect(temSombra("'hover:shadow-md'")).toBe(true);
    expect(temSombra('className="shadow"')).toBe(true);
    expect(temSombra("'shadow-[0_-2px_8px_rgba(0,0,0,0.06)]'")).toBe(true);
    expect(temSombra("'group-[.toaster]:!shadow-none'")).toBe(false);
    expect(temSombra("'focus-visible:shadow-[inset_0_0_0_0.5px_#570080]'")).toBe(false);
    expect(temSombra('const boxShadow = 1;')).toBe(false);
  });
});
