import { describe, it, expect } from 'vitest';
import {
  filterProfessionalsForService,
  shouldClearProfessional,
} from '../professional-filter';

const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('filterProfessionalsForService', () => {
  it('sem serviço escolhido devolve a lista inteira', () => {
    expect(filterProfessionalsForService(list, null)).toEqual(list);
  });

  it('mantém só os permitidos, preservando a ordem da lista', () => {
    expect(filterProfessionalsForService(list, ['c', 'a'])).toEqual([
      { id: 'a' },
      { id: 'c' },
    ]);
  });

  it('lista permitida vazia devolve vazio', () => {
    expect(filterProfessionalsForService(list, [])).toEqual([]);
  });
});

describe('shouldClearProfessional', () => {
  it('limpa quando o selecionado não atende', () => {
    expect(shouldClearProfessional('b', ['a', 'c'])).toBe(true);
  });

  it('mantém quando atende', () => {
    expect(shouldClearProfessional('a', ['a', 'c'])).toBe(false);
  });

  it('sem seleção não limpa', () => {
    expect(shouldClearProfessional('', ['a', 'c'])).toBe(false);
  });

  it('sem filtro (null) não limpa', () => {
    expect(shouldClearProfessional('x', null)).toBe(false);
  });
});
