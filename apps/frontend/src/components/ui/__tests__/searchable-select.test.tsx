import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { matchesSearch } from '@/lib/search-text';
import { SearchableSelect } from '../searchable-select';

const OPTIONS = [
  { value: 'make', label: 'Maquiagem social' },
  { value: 'pent', label: 'Penteado' },
  { value: 'mp', label: 'Make & Penteado (madrinhas)' },
];

function Harness() {
  const [value, setValue] = useState('');
  return <SearchableSelect testId="sel" value={value} options={OPTIONS} onChange={setValue} />;
}

describe('matchesSearch', () => {
  it('ignora acento, maiúscula e ordem das palavras', () => {
    expect(matchesSearch('Maquiágem Social', 'maquiagem')).toBe(true);
    expect(matchesSearch('PENTEADO', 'penteado')).toBe(true);
    expect(matchesSearch('Make & Penteado (madrinhas)', 'madrinhas make')).toBe(true);
    expect(matchesSearch('Penteado', 'escova')).toBe(false);
    expect(matchesSearch('Penteado', '   ')).toBe(true);
  });
});

describe('SearchableSelect', () => {
  it('abre com busca, filtra e escolhe a opção', async () => {
    render(<Harness />);
    const trigger = screen.getByTestId('sel');
    expect(trigger).toHaveTextContent('Selecione…');
    fireEvent.click(trigger);
    const search = await screen.findByTestId('sel-search');
    fireEvent.change(search, { target: { value: 'pentea' } });
    expect(screen.queryByTestId('sel-option-make')).toBeNull();
    expect(screen.getByTestId('sel-option-pent')).toBeInTheDocument();
    expect(screen.getByTestId('sel-option-mp')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sel-option-pent'));
    expect(trigger).toHaveAttribute('data-value', 'pent');
    expect(trigger).toHaveTextContent('Penteado');
    expect(screen.queryByTestId('sel-search')).toBeNull();
  });

  it('mostra aviso quando nada bate', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('sel'));
    fireEvent.change(await screen.findByTestId('sel-search'), { target: { value: 'xyz' } });
    expect(screen.getByText('Nada encontrado.')).toBeInTheDocument();
  });
});
