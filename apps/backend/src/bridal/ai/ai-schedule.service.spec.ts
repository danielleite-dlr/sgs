import type { AppConfigService } from '../../config/app-config.service';
import type { TenantContextService } from '../../database/tenant-context.service';
import type { BridalService } from '../bridal.service';
import type { AiScheduleBuild, AiScheduleContextBuilder } from './ai-schedule-context';
import { AiScheduleService } from './ai-schedule.service';
import type { Proposal, ScheduleContext } from './ai-schedule.schema';
import type { AnthropicLike } from './anthropic-client';
import { buildHeuristicProposal } from './heuristic-scheduler';

const ctx: ScheduleContext = {
  eventDate: '2030-06-15',
  readyBy: '2030-06-15T18:00:00.000Z',
  companionReadyBy: '2030-06-15T18:00:00.000Z',
  dayStart: '2030-06-15T10:00:00.000Z',
  dayEnd: '2030-06-15T22:00:00.000Z',
  travelBeforeMinutes: 0,
  travelAfterMinutes: 0,
  persons: [
    {
      ref: 'p1',
      role: 'bride',
      services: [
        { serviceId: 's1', label: 'Make', durationMinutes: 60, eligibleProfessionalIds: ['a'] },
      ],
    },
    {
      ref: 'p2',
      role: 'companion',
      services: [
        { serviceId: 's1', label: 'Make', durationMinutes: 60, eligibleProfessionalIds: ['a'] },
      ],
    },
  ],
  professionals: [{ id: 'a', label: 'prof_1', isFixed: false, dayMinutes: 0, rotationRank: 0 }],
  busy: [],
};

const build = (c: ScheduleContext = ctx): AiScheduleBuild => ({
  ctx: c,
  refs: new Map([
    ['p1', { groupMemberId: 'm1', clientName: 'Maria Silva', role: 'bride' }],
    ['p2', { groupMemberId: 'm2', clientName: 'Ana Souza', role: 'companion' }],
  ]),
  profLabels: new Map([
    ['a', 'Profissional A'],
    ['b', 'Profissional B'],
  ]),
  serviceNames: new Map([['s1', 'Maquiagem']]),
});

interface Row {
  id: string;
  groupId: string;
  inputHash: string;
  source: string;
  model: string | null;
  proposal: unknown;
  warnings: unknown;
  createdAt: Date;
}

function setup(opts: { client: AnthropicLike | null; limit?: number; ctx?: ScheduleContext }) {
  const rows: Row[] = [];
  const tx = {
    aiScheduleSuggestion: {
      findFirst: async ({ where }: { where: { groupId: string; inputHash: string } }) =>
        rows.find(
          (r) =>
            r.groupId === where.groupId && r.inputHash === where.inputHash && r.source === 'claude',
        ) ?? null,
      count: async () => rows.filter((r) => r.source === 'claude').length,
      create: async ({ data }: { data: Omit<Row, 'id' | 'createdAt'> }) => {
        const row = { ...data, id: `id-${rows.length + 1}`, createdAt: new Date() } as Row;
        rows.push(row);
        return row;
      },
    },
  };
  const tenant = {
    runWithTenant: async (_org: string, fn: (t: unknown) => unknown) => fn(tx),
  } as unknown as TenantContextService;
  const builder = { build: async () => build(opts.ctx) } as unknown as AiScheduleContextBuilder;
  const config = {
    anthropicModel: 'claude-test',
    aiScheduleDailyLimit: opts.limit ?? 20,
  } as unknown as AppConfigService;
  const svc = new AiScheduleService(tenant, builder, {} as BridalService, config, opts.client);
  return { svc, rows };
}

function fakeClient(responses: Array<() => unknown>) {
  const calls: unknown[] = [];
  const client: AnthropicLike = {
    messages: {
      parse: async (args: unknown) => {
        calls.push(args);
        const f = responses.shift();
        if (!f) throw new Error('sem resposta');
        return f() as never;
      },
    },
  };
  return { client, calls };
}

const valid = (): Proposal => buildHeuristicProposal(ctx).proposal;
const ok = () => ({ parsed_output: valid(), usage: { input_tokens: 100, output_tokens: 50 } });
const conflicting = () => {
  const p = valid();
  p.items = p.items.map((i) => ({
    ...i,
    startsAt: p.items[0].startsAt,
    endsAt: p.items[0].endsAt,
  }));
  return { parsed_output: p, usage: { input_tokens: 10, output_tokens: 5 } };
};

describe('AiScheduleService.suggest', () => {
  it('sem cliente (sem chave) usa a heurística e nunca chama a API', async () => {
    const { svc } = setup({ client: null });
    const r = await svc.suggest('org', 'mem', 'g');
    expect(r.suggestion?.source).toBe('heuristic');
    expect(r.suggestion?.fallbackReason).toBe('NO_API_KEY');
    expect(r.suggestion?.items).toHaveLength(2);
  });

  it('proposta válida do Claude: source claude, modelo e tokens gravados', async () => {
    const { client, calls } = fakeClient([ok]);
    const { svc, rows } = setup({ client });
    const r = await svc.suggest('org', 'mem', 'g');
    expect(r.suggestion?.source).toBe('claude');
    expect(r.suggestion?.model).toBe('claude-test');
    expect(rows[0]).toMatchObject({ source: 'claude', model: 'claude-test' });
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(calls[0])).not.toMatch(/Maria|Ana Souza/);
  });

  it('erro da API cai na heurística com API_ERROR', async () => {
    const { client } = fakeClient([
      () => {
        throw new Error('boom');
      },
    ]);
    const { svc } = setup({ client });
    const r = await svc.suggest('org', 'mem', 'g');
    expect(r.suggestion?.source).toBe('heuristic');
    expect(r.suggestion?.fallbackReason).toBe('API_ERROR');
  });

  it('saída com conflito duas vezes: heurística INVALID_OUTPUT após 2 chamadas', async () => {
    const { client, calls } = fakeClient([conflicting, conflicting]);
    const { svc } = setup({ client });
    const r = await svc.suggest('org', 'mem', 'g');
    expect(r.suggestion?.fallbackReason).toBe('INVALID_OUTPUT');
    expect(calls).toHaveLength(2);
    const retry = JSON.stringify(calls[1]);
    expect(retry).toContain('Violações da tentativa anterior');
  });

  it('mesma entrada duas vezes: segunda vem do cache sem chamar a API', async () => {
    const { client, calls } = fakeClient([ok, ok]);
    const { svc } = setup({ client });
    const a = await svc.suggest('org', 'mem', 'g');
    const b = await svc.suggest('org', 'mem', 'g');
    expect(a.suggestion?.cached).toBe(false);
    expect(b.suggestion?.cached).toBe(true);
    expect(b.suggestion?.source).toBe('claude');
    expect(calls).toHaveLength(1);
  });

  it('limite diário atingido: heurística LIMIT_REACHED', async () => {
    const { client, calls } = fakeClient([ok]);
    const { svc, rows } = setup({ client, limit: 1 });
    rows.push({
      id: 'x',
      groupId: 'outro',
      inputHash: 'h',
      source: 'claude',
      model: 'm',
      proposal: {},
      warnings: [],
      createdAt: new Date(),
    });
    const r = await svc.suggest('org', 'mem', 'g');
    expect(r.suggestion?.fallbackReason).toBe('LIMIT_REACHED');
    expect(calls).toHaveLength(0);
  });

  describe('prioridade de fixas (11)', () => {
    // a: fixa, b: não fixa; ambas fazem Make; só a noiva e a acompanhante.
    const prioCtx: ScheduleContext = {
      ...ctx,
      persons: ctx.persons.map((p) => ({
        ...p,
        services: p.services.map((sv) => ({ ...sv, eligibleProfessionalIds: ['a', 'b'] })),
      })),
      professionals: [
        { id: 'a', label: 'prof_1', isFixed: true, dayMinutes: 0, rotationRank: 0 },
        { id: 'b', label: 'prof_2', isFixed: false, dayMinutes: 0, rotationRank: 1 },
      ],
    };
    const usingNonFixed = () => {
      const p = buildHeuristicProposal(prioCtx).proposal;
      // mesma grade, mas o item da noiva vai para a não fixa (livre, sem choque: a fixa fica com a outra)
      p.items = p.items.map((i) => (i.personRef === 'p1' ? { ...i, professionalId: 'b' } : i));
      return { parsed_output: p, usage: { input_tokens: 10, output_tokens: 5 } };
    };
    const good = () => ({
      parsed_output: buildHeuristicProposal(prioCtx).proposal,
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    it('não fixa com fixa livre nas 2 tentativas: heurística INVALID_OUTPUT e retry cita a violação', async () => {
      const { client, calls } = fakeClient([usingNonFixed, usingNonFixed]);
      const { svc } = setup({ client, ctx: prioCtx });
      const r = await svc.suggest('org', 'mem', 'g');
      expect(r.suggestion?.source).toBe('heuristic');
      expect(r.suggestion?.fallbackReason).toBe('INVALID_OUTPUT');
      expect(JSON.stringify(calls[1])).toContain('PRIORITY_NOT_FOLLOWED');
    });

    it('1ª viola a prioridade e a 2ª corrige: source claude', async () => {
      const { client, calls } = fakeClient([usingNonFixed, good]);
      const { svc } = setup({ client, ctx: prioCtx });
      const r = await svc.suggest('org', 'mem', 'g');
      expect(r.suggestion?.source).toBe('claude');
      expect(calls).toHaveLength(2);
      expect(r.suggestion?.items.every((i) => i.professionalIsFixed)).toBe(true);
    });

    it('heurística com antecipação: aviso com o nome da pessoa e minutos', async () => {
      // fixa ocupada logo antes do limite: a noiva é antecipada para usar a fixa
      const busyCtx: ScheduleContext = {
        ...prioCtx,
        busy: [
          {
            professionalId: 'a',
            startsAt: '2030-06-15T16:00:00.000Z',
            endsAt: '2030-06-15T17:00:00.000Z',
          },
        ],
      };
      const { svc } = setup({ client: null, ctx: busyCtx });
      const r = await svc.suggest('org', 'mem', 'g');
      expect(r.suggestion?.warnings.join('\n')).toMatch(
        /Ana Souza \(Maquiagem\) atendida \d+ min antes do make-off/,
      );
    });
  });
});
