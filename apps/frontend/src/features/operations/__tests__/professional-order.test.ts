import { describe, expect, it } from 'vitest';
import { sortFixedFirst } from '../professional-order';

const nome = (p: { name: string }) => p.name;

describe('sortFixedFirst', () => {
  it('põe fixas primeiro e ordena por nome', () => {
    const list = [
      { id: '1', isFixed: false, name: 'Ana' },
      { id: '2', isFixed: true, name: 'Zélia' },
      { id: '3', isFixed: true, name: 'Bia' },
    ];
    expect(sortFixedFirst(list, nome).map((p) => p.id)).toEqual(['3', '2', '1']);
  });

  it('item sem isFixed conta como não fixa', () => {
    const list = [
      { id: '1', name: 'Ana' },
      { id: '2', isFixed: true, name: 'Zélia' },
      { id: '3', isFixed: null, name: 'Bia' },
    ];
    expect(sortFixedFirst(list, nome).map((p) => p.id)).toEqual(['2', '1', '3']);
  });

  it('ordena acentos em pt-BR e desempata por id', () => {
    const list = [
      { id: 'b', name: 'Fabi' },
      { id: 'a', name: 'Élida' },
      { id: 'z', name: 'Gabi' },
      { id: 'y', name: 'Gabi' },
    ];
    expect(sortFixedFirst(list, nome).map((p) => p.id)).toEqual(['a', 'b', 'y', 'z']);
  });

  it('não muta a entrada', () => {
    const list = [
      { id: '1', isFixed: false, name: 'Ana' },
      { id: '2', isFixed: true, name: 'Bia' },
    ];
    const copia = [...list];
    sortFixedFirst(list, nome);
    expect(list).toEqual(copia);
  });
});
