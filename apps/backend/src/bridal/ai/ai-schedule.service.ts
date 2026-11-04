import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AppConfigService } from '../../config/app-config.service';
import { TenantContextService } from '../../database/tenant-context.service';
import type { TenantPrismaClient } from '../../database/types';
import { mapBridalError, type BridalUserError } from '../bridal-errors';
import { BRIDAL_SCHEDULE_TX_OPTIONS, type BridalDepositInput } from '../bridal-schedule';
import { BridalService, type BridalSchedulePayload } from '../bridal.service';
import { AiScheduleContextBuilder, type AiScheduleBuild } from './ai-schedule-context';
import { SYSTEM_PROMPT, buildPromptInput, canonicalHash } from './ai-schedule.prompt';
import {
  ProposalSchema,
  type Proposal,
  type ScheduleContext,
} from './ai-schedule.schema';
import { ANTHROPIC_CLIENT, type AnthropicLike } from './anthropic-client';
import { buildHeuristicProposal } from './heuristic-scheduler';
import { validateProposal, type Violation } from './schedule-validator';

export type FallbackReason = 'NO_API_KEY' | 'LIMIT_REACHED' | 'API_ERROR' | 'INVALID_OUTPUT';

const CACHE_WINDOW_MS = 24 * 60 * 60 * 1000;

interface Unscheduled {
  personRef: string;
  serviceId: string;
}

interface Decision {
  source: 'claude' | 'heuristic';
  proposal: Proposal;
  unscheduled: Unscheduled[];
  warnings: string[];
  fallbackReason: FallbackReason | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiScheduleSuggestionView {
  id: string;
  source: string;
  model: string | null;
  cached: boolean;
  fallbackReason: string | null;
  items: {
    personRef: string;
    groupMemberId: string;
    personLabel: string;
    role: string;
    serviceId: string;
    serviceName: string;
    professionalId: string;
    professionalName: string;
    startsAt: Date;
    endsAt: Date;
  }[];
  unscheduled: {
    groupMemberId: string;
    personLabel: string;
    serviceId: string;
    serviceName: string;
  }[];
  warnings: string[];
  dayStart: Date;
  dayEnd: Date;
  readyBy: Date;
}

export interface AiScheduleSuggestionPayload {
  suggestion: AiScheduleSuggestionView | null;
  errors: BridalUserError[];
}

export interface ConfirmBridalScheduleInput {
  groupId: string;
  items: {
    groupMemberId: string;
    serviceId: string;
    professionalId: string;
    startsAt: Date | string;
    endsAt: Date | string;
  }[];
  deposits?: BridalDepositInput[] | null;
}

interface StoredProposal {
  items: Proposal['items'];
  rationale?: string;
  unscheduled?: Unscheduled[];
}

@Injectable()
export class AiScheduleService {
  private readonly logger = new Logger(AiScheduleService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly builder: AiScheduleContextBuilder,
    private readonly bridal: BridalService,
    private readonly config: AppConfigService,
    @Inject(ANTHROPIC_CLIENT) private readonly client: AnthropicLike | null,
  ) {}

  /** Chama o modelo (até 2 vezes) e valida; qualquer falha cai na heurística. */
  private async decide(ctx: ScheduleContext, model: string, limitReached: boolean): Promise<Decision> {
    const fallback = (reason: FallbackReason, tokens?: [number, number]): Decision => {
      const { proposal, unscheduled } = buildHeuristicProposal(ctx);
      const check = validateProposal(proposal, ctx);
      return {
        source: 'heuristic',
        proposal,
        unscheduled,
        warnings: check.warnings.map((w) => w.message),
        fallbackReason: reason,
        inputTokens: tokens ? tokens[0] : null,
        outputTokens: tokens ? tokens[1] : null,
      };
    };

    if (!this.client) return fallback('NO_API_KEY');
    if (limitReached) return fallback('LIMIT_REACHED');

    const base = buildPromptInput(ctx);
    let content = base;
    let tokensIn = 0;
    let tokensOut = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let violations: Violation[];
      try {
        const res = await this.client.messages.parse({
          model,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content }],
          output_config: { format: zodOutputFormat(ProposalSchema), effort: 'medium' },
        });
        tokensIn += res.usage?.input_tokens ?? 0;
        tokensOut += res.usage?.output_tokens ?? 0;
        const parsed = ProposalSchema.safeParse(res.parsed_output);
        if (!parsed.success) {
          violations = [
            { code: 'INVALID_TIME', message: 'A resposta não seguiu o formato do schema.' },
          ];
        } else {
          const check = validateProposal(parsed.data, ctx);
          if (check.ok) {
            return {
              source: 'claude',
              proposal: parsed.data,
              unscheduled: [],
              warnings: check.warnings.map((w) => w.message),
              fallbackReason: null,
              inputTokens: tokensIn,
              outputTokens: tokensOut,
            };
          }
          violations = check.violations;
        }
      } catch (e) {
        // Nunca logar o prompt (contém a agenda); só a mensagem do erro.
        this.logger.warn(`Falha ao consultar a Claude API: ${(e as Error).message}`);
        return fallback('API_ERROR', [tokensIn, tokensOut]);
      }
      content = `${base}\nViolações da tentativa anterior: ${JSON.stringify(violations)}`;
    }
    return fallback('INVALID_OUTPUT', [tokensIn, tokensOut]);
  }

  async suggest(
    orgId: string,
    memberId: string,
    groupId: string,
  ): Promise<AiScheduleSuggestionPayload> {
    try {
      const model = this.config.anthropicModel;
      // 1) Contexto + cache + cota (transação curta; a API é chamada fora dela).
      const pre = await this.tenant.runWithTenant(orgId, async (tx) => {
        const build = await this.builder.build(tx, orgId, groupId);
        const hash = canonicalHash(build.ctx, model);
        const since = new Date(Date.now() - CACHE_WINDOW_MS);
        const cached = await tx.aiScheduleSuggestion.findFirst({
          where: { groupId, inputHash: hash, source: 'claude', createdAt: { gt: since } },
          orderBy: { createdAt: 'desc' },
        });
        const used = cached
          ? 0
          : await tx.aiScheduleSuggestion.count({
              where: { source: 'claude', createdAt: { gt: since } },
            });
        return { build, hash, cached, used };
      });

      if (pre.cached) {
        const stored = pre.cached.proposal as unknown as StoredProposal;
        return {
          suggestion: this.toView(pre.build, {
            id: pre.cached.id,
            source: pre.cached.source,
            model: pre.cached.model,
            cached: true,
            fallbackReason: null,
            proposal: { items: stored.items, rationale: stored.rationale },
            unscheduled: stored.unscheduled ?? [],
            warnings: pre.cached.warnings as unknown as string[],
          }),
          errors: [],
        };
      }

      const limit = this.config.aiScheduleDailyLimit;
      const decision = await this.decide(pre.build.ctx, model, pre.used >= limit);

      const stored: StoredProposal = {
        items: decision.proposal.items,
        rationale: decision.proposal.rationale,
        unscheduled: decision.unscheduled,
      };
      const row = await this.tenant.runWithTenant(orgId, (tx) =>
        tx.aiScheduleSuggestion.create({
          data: {
            organizationId: orgId,
            groupId,
            inputHash: pre.hash,
            source: decision.source,
            model: decision.source === 'claude' ? model : null,
            proposal: stored as unknown as Prisma.InputJsonValue,
            warnings: decision.warnings as unknown as Prisma.InputJsonValue,
            inputTokens: decision.inputTokens,
            outputTokens: decision.outputTokens,
            createdBy: memberId,
          },
        }),
      );

      return {
        suggestion: this.toView(pre.build, {
          id: row.id,
          source: decision.source,
          model: decision.source === 'claude' ? model : null,
          cached: false,
          fallbackReason: decision.fallbackReason,
          proposal: decision.proposal,
          unscheduled: decision.unscheduled,
          warnings: decision.warnings,
        }),
        errors: [],
      };
    } catch (e) {
      const m = mapBridalError(e);
      if (m) return { suggestion: null, errors: [m] };
      throw e;
    }
  }

  private toView(
    build: AiScheduleBuild,
    s: {
      id: string;
      source: string;
      model: string | null;
      cached: boolean;
      fallbackReason: FallbackReason | null;
      proposal: Proposal;
      unscheduled: Unscheduled[];
      warnings: string[];
    },
  ): AiScheduleSuggestionView {
    const person = (ref: string) => build.refs.get(ref)!;
    return {
      id: s.id,
      source: s.source,
      model: s.model,
      cached: s.cached,
      fallbackReason: s.fallbackReason,
      items: [...s.proposal.items]
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        .map((i) => ({
          personRef: i.personRef,
          groupMemberId: person(i.personRef).groupMemberId,
          personLabel: person(i.personRef).clientName,
          role: person(i.personRef).role,
          serviceId: i.serviceId,
          serviceName: build.serviceNames.get(i.serviceId) ?? 'Serviço',
          professionalId: i.professionalId,
          professionalName: build.profLabels.get(i.professionalId) ?? 'Profissional',
          startsAt: new Date(i.startsAt),
          endsAt: new Date(i.endsAt),
        })),
      unscheduled: s.unscheduled.map((u) => ({
        groupMemberId: person(u.personRef).groupMemberId,
        personLabel: person(u.personRef).clientName,
        serviceId: u.serviceId,
        serviceName: build.serviceNames.get(u.serviceId) ?? 'Serviço',
      })),
      warnings: s.warnings,
      dayStart: new Date(build.ctx.dayStart),
      dayEnd: new Date(build.ctx.dayEnd),
      readyBy: new Date(build.ctx.readyBy),
    };
  }

  /** Revalida a proposta (possivelmente editada) no servidor e cria os agendamentos. */
  async confirm(
    orgId: string,
    memberId: string,
    input: ConfirmBridalScheduleInput,
  ): Promise<BridalSchedulePayload> {
    const items = input.items ?? [];
    try {
      const errors = await this.tenant.runWithTenant(
        orgId,
        async (tx: TenantPrismaClient): Promise<BridalUserError[]> => {
          const build = await this.builder.build(tx, orgId, input.groupId);
          const refByMember = new Map<string, string>();
          for (const [ref, info] of build.refs) refByMember.set(info.groupMemberId, ref);

          const unknown: BridalUserError[] = [];
          const proposal: Proposal = { items: [] };
          items.forEach((it, idx) => {
            const ref = refByMember.get(it.groupMemberId);
            if (!ref) {
              unknown.push({
                code: 'INVALID_PROPOSAL',
                message: 'Há pessoa sem serviços planejados para o evento.',
                field: `items.${idx}`,
              });
              return;
            }
            proposal.items.push({
              personRef: ref,
              serviceId: it.serviceId,
              professionalId: it.professionalId,
              startsAt: new Date(it.startsAt).toISOString(),
              endsAt: new Date(it.endsAt).toISOString(),
            });
          });
          if (unknown.length > 0) return unknown;

          const check = validateProposal(proposal, build.ctx);
          if (check.ok) return [];
          return check.violations.map((v) => {
            const idx = items.findIndex(
              (it) =>
                refByMember.get(it.groupMemberId) === v.personRef &&
                it.serviceId === v.serviceId,
            );
            return {
              code: 'INVALID_PROPOSAL',
              message: v.message,
              field: idx >= 0 ? `items.${idx}` : 'items',
            };
          });
        },
        BRIDAL_SCHEDULE_TX_OPTIONS,
      );
      if (errors.length > 0) return { group: null, appointmentIds: [], errors };

      return await this.bridal.schedule(orgId, memberId, {
        groupId: input.groupId,
        items: items.map((i) => ({ ...i, purpose: 'event' })),
        deposits: input.deposits,
      });
    } catch (e) {
      const m = mapBridalError(e);
      if (m) return { group: null, appointmentIds: [], errors: [m] };
      throw e;
    }
  }
}
