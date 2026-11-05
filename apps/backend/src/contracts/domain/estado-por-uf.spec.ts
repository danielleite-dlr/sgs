import { DEFAULT_CONTRACT_TEXTS, renderContractText } from './contract-texts';
import { estadoPorUf } from './estado-por-uf';

describe('estadoPorUf', () => {
  it('converte as 27 UFs em nome por extenso', () => {
    const ufs =
      'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
    expect(ufs).toHaveLength(27);
    for (const uf of ufs) {
      const nome = estadoPorUf(uf);
      expect(nome.length).toBeGreaterThan(2);
      expect(nome).not.toBe(uf);
    }
    expect(estadoPorUf('SP')).toBe('São Paulo');
    expect(estadoPorUf('rj')).toBe('Rio de Janeiro');
    expect(estadoPorUf('DF')).toBe('Distrito Federal');
  });

  it('UF desconhecida ou vazia volta o valor original', () => {
    expect(estadoPorUf('XX')).toBe('XX');
    expect(estadoPorUf('')).toBe('');
    expect(estadoPorUf(' Lisboa ')).toBe('Lisboa');
  });

  it('uf_foro renderiza o estado por extenso nas disposições finais', () => {
    const out = renderContractText(DEFAULT_CONTRACT_TEXTS.clauses, {
      tipo_cliente: 'NOIVA',
      prazo_restante_dias: '30',
      prazo_desistencia_dias: '60',
      cidade_foro: 'Osasco',
      uf_foro: estadoPorUf('SP'),
      studio_nome: 'S',
      studio_cnpj: '',
      studio_endereco: '',
      studio_representante: '',
      studio_representante_rg: '',
    });
    expect(out).toContain('Cidade de Osasco, Estado de São Paulo,');
    expect(out).not.toContain('Estado de SP');
  });
});
