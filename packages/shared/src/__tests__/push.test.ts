import { describe, expect, it } from 'vitest';
import { buildAgendaRoute, buildReminderRoute, isAllowedPushRoute } from '../push';

describe('buildAgendaRoute', () => {
  it('monta a rota do dia', () => {
    expect(buildAgendaRoute('2026-11-20')).toBe('/agenda?data=2026-11-20&visao=day');
  });
  it('inclui o agendamento quando informado', () => {
    expect(buildAgendaRoute('2026-11-20', '0193-abc')).toBe(
      '/agenda?data=2026-11-20&visao=day&agendamento=0193-abc',
    );
  });
  it('lança erro para data inválida', () => {
    expect(() => buildAgendaRoute('20/11/2026')).toThrow('data inválida');
  });
});

describe('isAllowedPushRoute', () => {
  it('aceita rotas da agenda', () => {
    expect(isAllowedPushRoute('/agenda?data=2026-11-20&visao=day&agendamento=x')).toBe(true);
    expect(isAllowedPushRoute('/agenda')).toBe(true);
  });
  it('rejeita rotas e valores perigosos', () => {
    for (const r of ['https://evil.com/agenda', '//evil.com', '/agenda/../admin', '/admin', 'javascript:alert(1)', 42, null, undefined]) {
      expect(isAllowedPushRoute(r)).toBe(false);
    }
  });
});

describe('rota de lembrete comercial', () => {
  it('aceita /comercial/lembretes com ou sem query', () => {
    expect(isAllowedPushRoute('/comercial/lembretes')).toBe(true);
    expect(isAllowedPushRoute('/comercial/lembretes?lembrete=0193-abc')).toBe(true);
  });
  it('continua rejeitando rotas vizinhas', () => {
    for (const r of ['/financeiro', '/comercial', '/comercial/leads', '/comercial/lembretes/../admin', '/comercial/lembretesx']) {
      expect(isAllowedPushRoute(r)).toBe(false);
    }
  });
  it('buildReminderRoute monta a rota e valida o id', () => {
    expect(buildReminderRoute('r1')).toBe('/comercial/lembretes?lembrete=r1');
    expect(() => buildReminderRoute('a/b')).toThrow();
  });
});
