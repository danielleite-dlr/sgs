import { readFileSync } from 'fs';
import * as path from 'path';
import {
  CONTRACT_TEXT_SECTIONS,
  CONTRACT_TEXT_VARIABLES,
  ContractTextVariable,
  DEFAULT_CONTRACT_TEXTS,
  findUnknownVariables,
  formatDateLongBR,
  parseBold,
  renderContractText,
  splitParagraphs,
  toWinAnsi,
  unsupportedChars,
  validateContractTexts,
} from './contract-texts';

const varsStudioJs: Record<ContractTextVariable, string> = {
  tipo_cliente: 'NOIVA',
  prazo_restante_dias: '10',
  prazo_desistencia_dias: '30',
  cidade_foro: 'Osasco',
  uf_foro: 'SP',
  studio_nome: 'Studio Jéssica Seixas Beauty',
  studio_cnpj: '48.562.103/0001-71',
  studio_endereco: 'Rua Álvares de Azevedo, 74 Centro – Osasco',
  studio_representante: 'Jéssica Seixas dos Santos Rodrigues',
  studio_representante_rg: '48.830.035-6',
};

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

describe('DEFAULT_CONTRACT_TEXTS', () => {
  it('tem as 5 seções', () => {
    expect([...CONTRACT_TEXT_SECTIONS]).toEqual(['title', 'intro', 'parties', 'trialNote', 'clauses']);
    for (const s of CONTRACT_TEXT_SECTIONS) expect(DEFAULT_CONTRACT_TEXTS[s].length).toBeGreaterThan(0);
  });

  it('título literal', () => {
    expect(DEFAULT_CONTRACT_TEXTS.title).toBe('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇO');
  });

  it('cláusulas parametrizadas', () => {
    const c = DEFAULT_CONTRACT_TEXTS.clauses;
    expect(c).toContain('arras confirmatórias');
    expect(c).toContain('**VIII. Exclusividade Profissional**');
    expect(c).toContain('{{prazo_desistencia_dias}}');
    expect(c).toContain('{{cidade_foro}}');
    expect(c).not.toContain('10 dias');
    expect(c).not.toContain('30 dias');
    expect(c).not.toContain('Osasco');
  });

  it('todas as variáveis usadas nos textos padrão são conhecidas', () => {
    for (const s of CONTRACT_TEXT_SECTIONS) expect(findUnknownVariables(DEFAULT_CONTRACT_TEXTS[s])).toEqual([]);
    expect(CONTRACT_TEXT_VARIABLES).toHaveLength(10);
  });

  it('renderiza frases da referência com as variáveis do Studio JS', () => {
    const c = renderContractText(DEFAULT_CONTRACT_TEXTS.clauses, varsStudioJs);
    expect(c).toContain('com até 30 dias de antecedência ao evento');
    expect(c).toContain('comarca da Cidade de Osasco, Estado de SP');
    expect(c).toContain('até 10 dias antes do evento');
  });
});

describe('conferência literal com a REFERENCE (W1)', () => {
  const ref = readFileSync(
    path.resolve(
      __dirname,
      '../../../../../.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-REFERENCE-modelo-studio-js.md',
    ),
    'utf8',
  );
  const lines = ref.split('\n');
  const item = (n: number): string => {
    const l = lines.find((x) => x.startsWith(`${n}. "`));
    if (!l) throw new Error(`item ${n} não encontrado`);
    return l.slice(`${n}. "`.length, l.length - 1);
  };
  const render = (s: keyof typeof DEFAULT_CONTRACT_TEXTS): string =>
    norm(renderContractText(DEFAULT_CONTRACT_TEXTS[s], varsStudioJs));

  it('intro (item 2)', () => {
    expect(render('intro')).toBe(norm(item(2)));
  });

  it('parties (itens 3 e 4)', () => {
    const sub = lines.find((l) => l.startsWith('   - Studio JS:'));
    if (!sub) throw new Error('sub-linha do Studio JS não encontrada');
    const [nome, cnpj, endereco, repr, rg] = sub
      .replace('   - Studio JS: ', '')
      .replace(/\.$/, '')
      .split(' · ')
      .map((p) => p.trim());
    const item4 = item(4)
      .replace('{nome do studio}', nome)
      .replace('{cnpj}', cnpj.replace(/^CNPJ /, ''))
      .replace('{endereço do studio}', endereco)
      .replace('{representante}', repr)
      .replace('{rg do representante}', rg.replace(/^RG /, ''));
    expect(render('parties')).toBe(norm(`${item(3)}\n\n${item4}`));
  });

  it('trialNote (item 7)', () => {
    expect(render('trialNote')).toBe(norm(item(7).replace('{NOIVA|DEBUTANTE}', 'NOIVA')));
  });

  it('clauses (Página 2)', () => {
    const start = lines.findIndex((l) => l.startsWith('**II. Do objeto do contrato e do Orçamento:**'));
    const end = lines.findIndex((l, i) => i > start && l.startsWith('"{cidade}'));
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = lines
      .slice(start, end)
      .join('\n')
      .replace('{cidade do foro}', 'Osasco')
      .replace('{estado do foro}', 'SP');
    expect(render('clauses')).toBe(norm(block));
  });
});

describe('renderContractText', () => {
  it('remove asteriscos dos valores', () => {
    expect(renderContractText('{{studio_nome}} x', { ...varsStudioJs, studio_nome: 'A**B' })).toBe('AB x');
  });
  it('aceita espaços dentro das chaves', () => {
    expect(renderContractText('{{ studio_nome }}', varsStudioJs)).toBe('Studio Jéssica Seixas Beauty');
  });
  it('variável desconhecida lança RangeError', () => {
    expect(() => renderContractText('{{foo}}', varsStudioJs)).toThrow(RangeError);
    expect(() => renderContractText('{{foo}}', varsStudioJs)).toThrow('UNKNOWN_TEMPLATE_VARIABLE');
  });
});

describe('validateContractTexts', () => {
  it('variável desconhecida', () => {
    expect(validateContractTexts({ clauses: 'oi {{x}}' })).toEqual([
      { section: 'clauses', code: 'UNKNOWN_TEMPLATE_VARIABLE', detail: 'x' },
    ]);
  });
  it('texto longo demais', () => {
    const issues = validateContractTexts({ intro: 'a'.repeat(20001) });
    expect(issues.map((i) => i.code)).toEqual(['TEXT_TOO_LONG']);
  });
  it('caracteres fora do WinAnsi', () => {
    expect(validateContractTexts({ intro: 'ok 😀' })).toEqual([
      { section: 'intro', code: 'TEXT_UNSUPPORTED_CHARS', detail: '😀' },
    ]);
  });
  it('texto vazio', () => {
    expect(validateContractTexts({ title: '   ' })[0]).toMatchObject({ section: 'title', code: 'TEXT_EMPTY' });
  });
  it('null/omitido = sem issue', () => {
    expect(validateContractTexts({ title: null, clauses: undefined })).toEqual([]);
    expect(validateContractTexts({})).toEqual([]);
  });
});

describe('parseBold', () => {
  it('trechos em negrito', () => {
    expect(parseBold('a **b** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c', bold: false },
    ]);
  });
  it('marcador solto fica literal', () => {
    expect(parseBold('a ** b')).toEqual([{ text: 'a ** b', bold: false }]);
  });
  it('só negrito', () => {
    expect(parseBold('**x**')).toEqual([{ text: 'x', bold: true }]);
  });
});

describe('splitParagraphs', () => {
  it('separa por linhas em branco', () => {
    expect(splitParagraphs('a\n\nb\n\n\nc')).toEqual(['a', 'b', 'c']);
  });
  it('quebra simples fica no parágrafo', () => {
    expect(splitParagraphs('a\nb\n\nc')).toEqual(['a\nb', 'c']);
  });
});

describe('WinAnsi', () => {
  it('unsupportedChars', () => {
    expect(unsupportedChars('Ação – “ok” º ✓')).toEqual(['✓']);
  });
  it('toWinAnsi normaliza NFC e remove não suportados', () => {
    expect(toWinAnsi('Ação ✓ ok')).toBe('Ação  ok');
    expect(toWinAnsi('x😀y')).toBe('xy');
  });
});

describe('formatDateLongBR', () => {
  it('data por extenso', () => {
    expect(formatDateLongBR('2026-11-04')).toBe('04 de novembro de 2026');
    expect(formatDateLongBR('2027-03-15')).toBe('15 de março de 2027');
  });
  it('data inválida', () => {
    expect(() => formatDateLongBR('2026-13-40')).toThrow('INVALID_DATE');
    expect(() => formatDateLongBR('abc')).toThrow(RangeError);
  });
});
