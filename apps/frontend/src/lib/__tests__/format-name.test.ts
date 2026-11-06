import { describe, it, expect } from 'vitest';
import { toDisplayName } from '../format-name';

describe('toDisplayName', () => {
  it('nome todo em maiúsculas vira caixa normal', () => {
    expect(toDisplayName('MARIA DA SILVA')).toBe('Maria da Silva');
  });

  it('nome em minúsculas ganha iniciais maiúsculas e mantém acentos', () => {
    expect(toDisplayName('joão pedro')).toBe('João Pedro');
    expect(toDisplayName('ÁGATHA ÉRICA')).toBe('Ágatha Érica');
  });

  it('partículas ficam minúsculas, menos na primeira palavra', () => {
    expect(toDisplayName('ANA DOS SANTOS E SOUZA DE LIMA DAS DORES DO CARMO')).toBe(
      'Ana dos Santos e Souza de Lima das Dores do Carmo',
    );
    expect(toDisplayName('da silva')).toBe('Da Silva');
  });

  it('espaços repetidos viram um', () => {
    expect(toDisplayName('  maria   souza  ')).toBe('Maria Souza');
  });

  it('vazio devolve vazio', () => {
    expect(toDisplayName('')).toBe('');
    expect(toDisplayName(null)).toBe('');
    expect(toDisplayName(undefined)).toBe('');
  });
});
