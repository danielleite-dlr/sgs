import { sha256Hex } from '../../contracts/domain/contract-template';
import type { ScheduleContext } from './ai-schedule.schema';

export const SYSTEM_PROMPT = `Você monta a agenda de um evento de noiva num salão. Regras obrigatórias: cada pessoa recebe cada serviço listado exatamente uma vez; use só profissionais em eligibleProfessionalIds do serviço; duração exata; sem sobreposição por profissional, por pessoa nem com busy; dentro de [dayStart, dayEnd]; a noiva (role bride) termina até readyBy, por último e o mais perto possível dele; cada acompanhante (role companion) termina até companionReadyBy (make-off ou saída das acompanhantes), o mais perto possível dele; com deslocamento, reserve travelBeforeMinutes antes do primeiro e travelAfterMinutes depois do último atendimento de cada profissional. Prioridade de profissional: prefira sempre profissionais com isFixed=true livres; use isFixed=false só se nenhuma fixa elegível estiver livre no horário, mesmo que a fixa fique mais cedo. Entre fixas, prefira a de menor dayMinutes (somando o que você já atribuiu) e, empatando, a de menor rotationRank. A lista professionals já vem na ordem de preferência. Prefira concentrar o trabalho e evitar janelas ociosas. Responda só com o JSON do schema; horários ISO 8601 UTC.`;

/** Entrada enviada ao modelo: somente rótulos (pessoas p1..pN, profissionais prof_1..), sem PII. */
export function buildPromptInput(ctx: ScheduleContext): string {
  return JSON.stringify({
    eventDate: ctx.eventDate,
    readyBy: ctx.readyBy,
    companionReadyBy: ctx.companionReadyBy,
    dayStart: ctx.dayStart,
    dayEnd: ctx.dayEnd,
    travelBeforeMinutes: ctx.travelBeforeMinutes,
    travelAfterMinutes: ctx.travelAfterMinutes,
    persons: ctx.persons.map((p) => ({
      ref: p.ref,
      role: p.role,
      services: p.services.map((s) => ({
        serviceId: s.serviceId,
        label: s.label,
        durationMinutes: s.durationMinutes,
        eligibleProfessionalIds: s.eligibleProfessionalIds,
      })),
    })),
    professionals: ctx.professionals.map((x) => ({
      id: x.id,
      label: x.label,
      isFixed: x.isFixed,
      dayMinutes: x.dayMinutes,
      rotationRank: x.rotationRank,
    })),
    busy: ctx.busy,
  });
}

/** Hash estável da entrada (arrays em ordem canônica) + modelo; chave do cache de 24h. */
export function canonicalHash(ctx: ScheduleContext, model: string): string {
  const byStr = <T>(f: (x: T) => string) => (a: T, b: T) => f(a).localeCompare(f(b));
  const canon = {
    eventDate: ctx.eventDate,
    readyBy: ctx.readyBy,
    companionReadyBy: ctx.companionReadyBy,
    dayStart: ctx.dayStart,
    dayEnd: ctx.dayEnd,
    travelBeforeMinutes: ctx.travelBeforeMinutes,
    travelAfterMinutes: ctx.travelAfterMinutes,
    persons: [...ctx.persons]
      .sort(byStr((p) => p.ref))
      .map((p) => ({
        ref: p.ref,
        role: p.role,
        services: [...p.services]
          .sort(byStr((s) => s.serviceId))
          .map((s) => ({
            serviceId: s.serviceId,
            durationMinutes: s.durationMinutes,
            eligibleProfessionalIds: [...s.eligibleProfessionalIds].sort(),
          })),
      })),
    professionals: [...ctx.professionals]
      .sort(byStr((x) => x.id))
      .map((x) => [x.id, x.isFixed, x.dayMinutes, x.rotationRank]),
    busy: [...ctx.busy]
      .sort(byStr((b) => `${b.professionalId}|${b.startsAt}|${b.endsAt}`))
      .map((b) => [b.professionalId, b.startsAt, b.endsAt]),
    model,
  };
  return sha256Hex(JSON.stringify(canon));
}
