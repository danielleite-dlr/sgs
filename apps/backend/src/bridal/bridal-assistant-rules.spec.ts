import {
  BRIDAL_ASSISTANT_BLOCK_KIND,
  assistantAccrualItemName,
  assistantBlockNote,
  assistantIneligibilityReason,
  isAssistantEligible,
  isAssistantPending,
  type AssistantGroupLike,
} from './bridal-assistant-rules';

function group(over: Partial<AssistantGroupLike> = {}): AssistantGroupLike {
  return {
    eventKind: 'noiva',
    locationKind: 'studio',
    status: 'active',
    pkg: { includesBridalAssistant: true, deletedAt: null },
    ...over,
  };
}

function pendingInput(over: Record<string, unknown> = {}) {
  return {
    ...group(),
    assistantMemberId: null as string | null,
    eventDateYmd: '2026-12-05',
    todayYmd: '2026-11-24',
    eventComandaClosed: false,
    ...over,
  };
}

describe('bridal-assistant-rules', () => {
  describe('isAssistantEligible', () => {
    it('noiva + estúdio + ativo + pacote marcado é elegível', () => {
      expect(isAssistantEligible(group())).toBe(true);
    });
    it('evento externo não tem assistente (D-03)', () => {
      expect(isAssistantEligible(group({ locationKind: 'external' }))).toBe(false);
    });
    it('debutante fica fora da fase', () => {
      expect(isAssistantEligible(group({ eventKind: 'debutante' }))).toBe(false);
    });
    it('grupo cancelado não é elegível', () => {
      expect(isAssistantEligible(group({ status: 'cancelled' }))).toBe(false);
    });
    it('sem pacote não é elegível', () => {
      expect(isAssistantEligible(group({ pkg: null }))).toBe(false);
    });
    it('pacote sem a marca não é elegível', () => {
      expect(
        isAssistantEligible(group({ pkg: { includesBridalAssistant: false, deletedAt: null } })),
      ).toBe(false);
    });
    it('pacote excluído não é elegível', () => {
      expect(
        isAssistantEligible(
          group({ pkg: { includesBridalAssistant: true, deletedAt: new Date() } }),
        ),
      ).toBe(false);
    });
  });

  describe('assistantIneligibilityReason', () => {
    it('null quando elegível', () => {
      expect(assistantIneligibilityReason(group())).toBeNull();
    });
    it('grupo inativo', () => {
      expect(assistantIneligibilityReason(group({ status: 'cancelled' }))).toBe(
        'o grupo não está ativo',
      );
    });
    it('não é noiva', () => {
      expect(assistantIneligibilityReason(group({ eventKind: 'debutante' }))).toBe(
        'só noivas têm assistente',
      );
    });
    it('fora do estúdio', () => {
      expect(assistantIneligibilityReason(group({ locationKind: 'external' }))).toBe(
        'evento fora do estúdio',
      );
    });
    it('pacote sem assistente (sem pacote, excluído ou sem marca)', () => {
      const msg = 'o pacote não inclui assistente da noiva';
      expect(assistantIneligibilityReason(group({ pkg: null }))).toBe(msg);
      expect(
        assistantIneligibilityReason(
          group({ pkg: { includesBridalAssistant: false, deletedAt: null } }),
        ),
      ).toBe(msg);
      expect(
        assistantIneligibilityReason(
          group({ pkg: { includesBridalAssistant: true, deletedAt: new Date() } }),
        ),
      ).toBe(msg);
    });
    it('respeita a ordem: status antes de tipo', () => {
      expect(
        assistantIneligibilityReason(group({ status: 'cancelled', eventKind: 'debutante' })),
      ).toBe('o grupo não está ativo');
    });
  });

  describe('isAssistantPending', () => {
    it('elegível, sem assistente, evento futuro, comanda aberta', () => {
      expect(isAssistantPending(pendingInput())).toBe(true);
    });
    it('evento hoje ainda é pendente', () => {
      expect(isAssistantPending(pendingInput({ eventDateYmd: '2026-11-24' }))).toBe(true);
    });
    it('evento no passado não é pendente', () => {
      expect(isAssistantPending(pendingInput({ eventDateYmd: '2026-11-23' }))).toBe(false);
    });
    it('com assistente definida não é pendente', () => {
      expect(isAssistantPending(pendingInput({ assistantMemberId: 'm1' }))).toBe(false);
    });
    it('comanda do dia fechada não é pendente', () => {
      expect(isAssistantPending(pendingInput({ eventComandaClosed: true }))).toBe(false);
    });
    it('não elegível (externa) não é pendente', () => {
      expect(isAssistantPending(pendingInput({ locationKind: 'external' }))).toBe(false);
    });
  });

  describe('textos', () => {
    it('nota do bloqueio', () => {
      expect(assistantBlockNote('Maria Souza')).toBe('Acompanhando noiva Maria Souza');
    });
    it('nome do item de repasse', () => {
      expect(assistantAccrualItemName('Noiva Maria')).toBe('Assistente da Noiva — Noiva Maria');
    });
    it('kind do bloqueio', () => {
      expect(BRIDAL_ASSISTANT_BLOCK_KIND).toBe('acompanhamento');
    });
  });
});
