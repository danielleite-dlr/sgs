import {
  NOT_ASSISTANT_ROLE_WHERE,
  assistantNotSchedulableMessage,
  fictitiousAssistantEmail,
  isAssistantRole,
  onlyAssistantMemberships,
} from './assistant-role';

describe('assistant-role', () => {
  it('isAssistantRole', () => {
    expect(isAssistantRole('ASSISTANT')).toBe(true);
    expect(isAssistantRole('PROFESSIONAL')).toBe(false);
    expect(isAssistantRole(null)).toBe(false);
    expect(isAssistantRole(undefined)).toBe(false);
  });
  it('onlyAssistantMemberships', () => {
    expect(onlyAssistantMemberships([])).toBe(false);
    expect(onlyAssistantMemberships([{ roleName: 'ASSISTANT' }])).toBe(true);
    expect(
      onlyAssistantMemberships([
        { roleName: 'ASSISTANT' },
        { roleName: 'PROFESSIONAL' },
      ]),
    ).toBe(false);
  });
  it('e-mail fictício', () => {
    expect(fictitiousAssistantEmail('abc')).toBe(
      'assistente.abc@sem-login.invalid',
    );
  });
  it('mensagem de não agendável', () => {
    expect(assistantNotSchedulableMessage('Ana')).toBe(
      'Ana é assistente de noiva/debutante e não faz atendimento. Escolha outra profissional.',
    );
  });
  it('NOT_ASSISTANT_ROLE_WHERE', () => {
    expect(NOT_ASSISTANT_ROLE_WHERE).toEqual({
      role: { name: { not: 'ASSISTANT' } },
    });
  });
});
