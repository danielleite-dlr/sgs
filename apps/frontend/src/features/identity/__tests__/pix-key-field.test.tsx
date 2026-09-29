import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PixKeyField } from '../components/PixKeyField';
import type { PixKeyType } from '../pix-key';

function Harness() {
  const [type, setType] = useState<PixKeyType | null>(null);
  const [value, setValue] = useState('');
  return (
    <PixKeyField
      label="Chave Pix"
      type={type}
      value={value}
      onTypeChange={setType}
      onValueChange={setValue}
    />
  );
}

describe('PixKeyField', () => {
  it('só libera a chave depois de escolher o tipo', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Chave Pix')).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'CPF' }));
    expect(screen.getByLabelText('Chave Pix')).toBeEnabled();
  });

  it('aplica a máscara do tipo e limpa a chave ao trocar de tipo', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'CPF' }));
    const input = screen.getByLabelText('Chave Pix');
    fireEvent.change(input, { target: { value: '12345678909' } });
    expect(input).toHaveValue('123.456.789-09');

    fireEvent.click(screen.getByRole('radio', { name: 'Celular' }));
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: '11987654321' } });
    expect(input).toHaveValue('(11) 98765-4321');
  });
});
