import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmByNameDialog } from '../confirm-by-name-dialog';

function setup(props: Partial<React.ComponentProps<typeof ConfirmByNameDialog>> = {}) {
  const onConfirm = vi.fn();
  render(
    <ConfirmByNameDialog
      open
      onOpenChange={() => {}}
      title="Excluir Ana?"
      description={<p>Esta ação é irreversível. Vamos apagar tudo.</p>}
      expectedName="Ana Álvares"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm };
}

const botao = () => screen.getByTestId('confirm-delete');
const digitar = (v: string) =>
  fireEvent.change(screen.getByTestId('confirm-name-input'), { target: { value: v } });

describe('ConfirmByNameDialog', () => {
  it('deixa o botão desabilitado até o nome bater', () => {
    setup();
    expect(botao()).toBeDisabled();
    digitar('Ana');
    expect(botao()).toBeDisabled();
    digitar('ana álvares');
    expect(botao()).toBeEnabled();
  });

  it('ignora espaços nas pontas, mas acento diferente não confere', () => {
    setup();
    digitar('  ANA ÁLVARES  ');
    expect(botao()).toBeEnabled();
    digitar('Ana Alvares');
    expect(botao()).toBeDisabled();
  });

  it('avisa que é irreversível', () => {
    setup();
    expect(screen.getByText(/irreversível/)).toBeInTheDocument();
  });

  it('chama onConfirm ao confirmar com o nome certo', () => {
    const { onConfirm } = setup();
    digitar('Ana Álvares');
    fireEvent.click(botao());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('não confirma com o nome errado nem pelo Enter', () => {
    const { onConfirm } = setup();
    digitar('Outra pessoa');
    fireEvent.submit(screen.getByTestId('confirm-name-input').closest('form')!);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('mostra o erro dentro do diálogo e mantém o botão', () => {
    setup({ error: 'Ana tem 1 comanda aberta.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Ana tem 1 comanda aberta.');
    expect(botao()).toBeInTheDocument();
  });
});
