import {
  DEFAULT_BRIDAL_TEMPLATE,
  formatBRL,
  formatDateBR,
  maskCpf,
  normalizeText,
  renderContract,
  sha256Hex,
  TEMPLATE_VARIABLES,
  validateTemplate,
} from './contract-template';

const vars = {
  noiva_nome: 'Maria Silva',
  noiva_cpf: '***.456.789-**',
  evento_data: '20/12/2026',
  evento_local: 'Sítio das Flores',
  itens: '- Maquiagem\n- Penteado',
  valor_total: 'R$ 8.000,00',
  entrada: 'R$ 2.400,00',
  prazo_restante: '10/12/2026',
  politica_cancelamento: 'Política.',
};

describe('validateTemplate', () => {
  it('modelo padrão é válido e completo', () => {
    expect(validateTemplate(DEFAULT_BRIDAL_TEMPLATE)).toEqual({ unknown: [], missing: [] });
  });
  it('detecta desconhecidas e ausentes', () => {
    const r = validateTemplate('Olá {{ noiva_nome }} {{foo}}');
    expect(r.unknown).toEqual(['foo']);
    expect(r.missing).toHaveLength(TEMPLATE_VARIABLES.length - 1);
    expect(r.missing).not.toContain('noiva_nome');
  });
});

describe('renderContract', () => {
  it('modelo padrão renderiza sem placeholders', () => {
    const out = renderContract(DEFAULT_BRIDAL_TEMPLATE, vars);
    expect(out).not.toContain('{{');
    expect(out).toContain('Maria Silva');
    expect(out).toContain('R$ 8.000,00');
  });
  it('substitui todas as ocorrências', () => {
    expect(renderContract('{{noiva_nome}} e {{ noiva_nome }}', vars)).toBe('Maria Silva e Maria Silva');
  });
  it('variável desconhecida lança erro', () => {
    expect(() => renderContract('{{foo}}', vars)).toThrow('UNKNOWN_VARIABLE:foo');
  });
  it('hash estável e independente de CRLF', () => {
    const a = renderContract('linha1\r\nlinha2 {{noiva_nome}}', vars);
    const b = renderContract('linha1\nlinha2 {{noiva_nome}}', vars);
    expect(sha256Hex(a)).toBe(sha256Hex(b));
    expect(sha256Hex(a)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('valor da variável não é reinterpretado', () => {
    expect(renderContract('{{noiva_nome}}', { ...vars, noiva_nome: '{{foo}}' })).toBe('{{foo}}');
  });
});

describe('helpers', () => {
  it('normalizeText', () => {
    expect(normalizeText('  a\r\nb \n')).toBe('a\nb');
  });
  it.each([
    [800000, 'R$ 8.000,00'],
    [5, 'R$ 0,05'],
    [123456789, 'R$ 1.234.567,89'],
  ])('formatBRL(%d)', (c, expected) => {
    expect(formatBRL(c)).toBe(expected);
  });
  it('maskCpf', () => {
    expect(maskCpf('12345678909')).toBe('***.456.789-**');
    expect(maskCpf('123.456.789-09')).toBe('***.456.789-**');
  });
  it('maskCpf inválido devolve vazio', () => {
    expect(maskCpf('123')).toBe('');
  });
  it('formatDateBR', () => {
    expect(formatDateBR('2026-12-20')).toBe('20/12/2026');
  });
});
