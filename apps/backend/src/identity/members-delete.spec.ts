import { openWorkMessage } from './members.service';

describe('openWorkMessage', () => {
  it('monta só as partes não-zero, no plural', () => {
    expect(openWorkMessage('Ana', 3, 1)).toBe(
      'Ana tem 3 atendimentos agendados e 1 comanda aberta. Conclua ou remaneje antes de excluir.',
    );
  });

  it('usa o singular quando é 1', () => {
    expect(openWorkMessage('Ana', 1, 0)).toBe(
      'Ana tem 1 atendimento agendado. Conclua ou remaneje antes de excluir.',
    );
  });

  it('só comandas', () => {
    expect(openWorkMessage('Bia', 0, 2)).toBe(
      'Bia tem 2 comandas abertas. Conclua ou remaneje antes de excluir.',
    );
  });
});
