import { z } from 'zod';

/**
 * Contexto canônico da sugestão de agenda do evento (AI-01).
 * Sem PII: pessoas são rótulos (`p1`..`pN`). Todos os instantes são ISO.
 */
export interface ScheduleContext {
  eventDate: string; // 'YYYY-MM-DD' (data local)
  readyBy: string; // ISO instant: todos terminam até aqui; noiva por último
  dayStart: string; // ISO instant (janela do dia — D-25)
  dayEnd: string; // ISO instant
  travelBeforeMinutes: number; // 0 se estúdio
  travelAfterMinutes: number;
  persons: {
    ref: string; // 'p1'...'pN' — rótulo SEM PII
    role: 'bride' | 'companion';
    services: {
      serviceId: string;
      label: string;
      durationMinutes: number;
      eligibleProfessionalIds: string[];
    }[];
  }[];
  professionals: { id: string; label: string }[];
  busy: { professionalId: string; startsAt: string; endsAt: string }[]; // agendamentos + time_blocks do dia
}

// Schema enviado ao Claude: SIMPLES (strings, sem min/max). Regras fortes ficam no validador.
export const ProposalItemSchema = z.object({
  personRef: z.string(),
  serviceId: z.string(),
  professionalId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});

export const ProposalSchema = z.object({
  items: z.array(ProposalItemSchema),
  rationale: z.string().optional(),
});

export type ProposalItem = z.infer<typeof ProposalItemSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
