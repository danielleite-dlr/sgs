import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContractTextView } from '../components/ContractTextView';

describe('ContractTextView (UX-11)', () => {
  it('interpreta o negrito, separa parágrafos e não mostra "**"', () => {
    const { container } = render(
      <ContractTextView text={'**I. Das partes:**\n\n**Contratado:** Studio JS'} />,
    );
    const root = screen.getByTestId('contract-text');
    const strongs = Array.from(root.querySelectorAll('strong')).map((s) => s.textContent);
    expect(strongs).toEqual(['I. Das partes:', 'Contratado:']);
    expect(root.querySelectorAll('p')).toHaveLength(2);
    expect(container.textContent).not.toContain('**');
    expect(root).toHaveTextContent('Contratado: Studio JS');
  });

  it('quebra de linha simples vira <br /> dentro do mesmo parágrafo', () => {
    render(<ContractTextView text={'Linha 1\nLinha 2'} />);
    const root = screen.getByTestId('contract-text');
    const ps = root.querySelectorAll('p');
    expect(ps).toHaveLength(1);
    expect(ps[0]!.querySelectorAll('br')).toHaveLength(1);
    expect(ps[0]).toHaveTextContent('Linha 1Linha 2');
  });
});
