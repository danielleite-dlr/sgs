import { describe, expect, it } from 'vitest';
import { brandInitials, brandName, personInitials } from '../brand';

describe('brandInitials', () => {
  it('usa a última palavra quando ela já é uma sigla de 2–3 letras', () => {
    expect(brandInitials('Studio JS')).toBe('JS');
  });

  it('usa a primeira letra das duas primeiras palavras', () => {
    expect(brandInitials('Ateliê Maria Clara')).toBe('AM');
  });

  it('cai em "SG" sem nome', () => {
    expect(brandInitials('')).toBe('SG');
    expect(brandInitials(null)).toBe('SG');
  });
});

describe('brandName', () => {
  it('devolve o nome da organização ou "SGS"', () => {
    expect(brandName(null)).toBe('SGS');
    expect(brandName('  ')).toBe('SGS');
    expect(brandName('Studio JS')).toBe('Studio JS');
  });
});

describe('personInitials', () => {
  it('pega a primeira e a última palavra', () => {
    expect(personInitials('maria da silva')).toBe('MS');
    expect(personInitials('Juliana')).toBe('J');
    expect(personInitials(null)).toBe('');
  });
});
