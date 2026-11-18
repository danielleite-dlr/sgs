import { adminPrisma } from './setup';
import {
  createPhase9World,
  destroyPhase9World,
  gqlAs,
  insertDealRow,
  insertLeadRow,
  type Phase9World,
} from './helpers/phase9-fixtures';
import { CommercialRemindersService } from '../../src/commercial/commercial-reminders.service';
import { PushEventsService } from '../../src/push/push-events.service';

const FIELDS = `id title description dueAt completedAt notifiedAt overdue dealId
  lead { id fullName } createdBy { id roleName }`;
const CREATE = `mutation($i: CreateCommercialReminderInput!) {
  createCommercialReminder(input: $i) { reminder { ${FIELDS} } errors { code field } }
}`;
const UPDATE = `mutation($i: UpdateCommercialReminderInput!) {
  updateCommercialReminder(input: $i) { reminder { ${FIELDS} } errors { code } }
}`;
const COMPLETE = `mutation($id: UUID!, $c: Boolean!) {
  completeCommercialReminder(id: $id, completed: $c) { reminder { ${FIELDS} } errors { code } }
}`;
const DEL = `mutation($id: UUID!) { deleteCommercialReminder(id: $id) { ok errors { code } } }`;
const LIST = `query($f: CommercialReminderFilter) {
  commercialReminders(filter: $f) { total items { id title overdue } }
}`;
const COUNTS = `query { commercialReminderCounts { overdue today } }`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}
type Gql = (q: string, v?: Record<string, unknown>) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const H = 3_600_000;
const inHours = (h: number) => new Date(Date.now() + h * H).toISOString();

describe('fase 9 - lembretes do Comercial', () => {
  let w: Phase9World;
  let asManager: Gql;
  let asAtt: Gql;
  let asAttB: Gql;
  let asPro: Gql;
  let svc: CommercialRemindersService;
  let dealA: string;
  let dealB: string;

  beforeAll(async () => {
    w = await createPhase9World('p9rem');
    asManager = gqlAs(w, w.tokens.manager);
    asAtt = gqlAs(w, w.tokens.attendant);
    asAttB = gqlAs(w, w.attendantB.token);
    asPro = gqlAs(w, w.tokens.proA);
    svc = w.app.get(CommercialRemindersService);
    const la = await insertLeadRow(w, { createdBy: w.members.attendant });
    dealA = await insertDealRow(w, { leadId: la, assignee: w.members.attendant });
    const lb = await insertLeadRow(w, { createdBy: w.attendantB.memberId });
    dealB = await insertDealRow(w, { leadId: lb, assignee: w.attendantB.memberId });
  }, 120_000);

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  const mk = async (data: {
    title?: string;
    dueAt?: Date;
    completedAt?: Date | null;
    notifiedAt?: Date | null;
    createdBy?: string | null;
    dealId?: string | null;
    orgId?: string;
  }) =>
    adminPrisma.commercialReminder.create({
      data: {
        organizationId: data.orgId ?? w.orgId,
        title: data.title ?? 'Ligar',
        dueAt: data.dueAt ?? new Date(),
        completedAt: data.completedAt ?? null,
        notifiedAt: data.notifiedAt ?? null,
        createdBy: data.createdBy ?? null,
        dealId: data.dealId ?? null,
      },
    });

  it('create valida título e data; com dealId preenche o lead do negócio', async () => {
    const empty = await asManager(CREATE, { i: { title: '  ', dueAt: inHours(1) } });
    expect(empty.data.createCommercialReminder.errors[0].code).toBe('TITLE_REQUIRED');
    const long = await asManager(CREATE, { i: { title: 'x'.repeat(161), dueAt: inHours(1) } });
    expect(long.data.createCommercialReminder.errors[0].code).toBe('TITLE_TOO_LONG');
    const ghost = await asAtt(CREATE, { i: { title: 'a', dueAt: inHours(1), dealId: dealB } });
    expect(ghost.data.createCommercialReminder.errors[0].code).toBe('NOT_FOUND');

    const ok = await asAtt(CREATE, {
      i: { title: 'Ligar p/ noiva', dueAt: inHours(2), dealId: dealA },
    });
    const r = ok.data.createCommercialReminder.reminder;
    expect(r.dealId).toBe(dealA);
    expect(r.lead.id).toBeTruthy();
    expect(r.createdBy.id).toBe(w.members.attendant);

    const solo = await asManager(CREATE, { i: { title: 'Sem vínculo', dueAt: inHours(2) } });
    expect(solo.data.createCommercialReminder.reminder.lead).toBeNull();
  });

  it('listas por situação e contagens', async () => {
    const tag = `lst-${Date.now()}`;
    const over = await mk({ title: `${tag}-over`, dueAt: new Date(Date.now() - 2 * H) });
    const later = await mk({ title: `${tag}-later`, dueAt: new Date(Date.now() + 72 * H) });
    const done = await mk({ title: `${tag}-done`, completedAt: new Date() });
    const ids = async (status: string) => {
      const res = await asManager(LIST, { f: { status, limit: 200 } });
      return res.data.commercialReminders.items.map((i: { id: string }) => i.id);
    };
    expect(await ids('overdue')).toContain(over.id);
    expect(await ids('overdue')).not.toContain(later.id);
    expect(await ids('upcoming')).toContain(later.id);
    expect(await ids('pending')).toEqual(expect.arrayContaining([over.id, later.id]));
    expect(await ids('pending')).not.toContain(done.id);
    expect(await ids('done')).toContain(done.id);
    const counts = await asManager(COUNTS);
    expect(counts.data.commercialReminderCounts.overdue).toBeGreaterThanOrEqual(1);
  });

  it('update reagendando zera notified_at; complete grava e limpa completed_at', async () => {
    const r = await mk({ notifiedAt: new Date(), dueAt: new Date(Date.now() - H) });
    const u = await asManager(UPDATE, { i: { id: r.id, dueAt: inHours(5) } });
    expect(u.data.updateCommercialReminder.reminder.notifiedAt).toBeNull();
    const same = await asManager(UPDATE, { i: { id: r.id, title: 'Novo título' } });
    expect(same.data.updateCommercialReminder.reminder.title).toBe('Novo título');
    const c = await asManager(COMPLETE, { id: r.id, c: true });
    expect(c.data.completeCommercialReminder.reminder.completedAt).not.toBeNull();
    const o = await asManager(COMPLETE, { id: r.id, c: false });
    expect(o.data.completeCommercialReminder.reminder.completedAt).toBeNull();
    const bad = await asManager(UPDATE, { i: { id: r.id, dueAt: 'lixo' } });
    expect(bad.errors).toBeDefined();
  });

  it('visibilidade da atendente e exclusão', async () => {
    const byB = await mk({ title: 'da B', createdBy: w.attendantB.memberId });
    const onDealA = await mk({
      title: 'gerente no negócio da A',
      createdBy: w.members.manager,
      dealId: dealA,
    });
    const listed = await asAtt(LIST, { f: { limit: 200 } });
    const got = listed.data.commercialReminders.items.map((i: { id: string }) => i.id);
    expect(got).not.toContain(byB.id);
    expect(got).toContain(onDealA.id);

    const upd = await asAtt(UPDATE, { i: { id: byB.id, title: 'x' } });
    expect(upd.data.updateCommercialReminder.errors[0].code).toBe('NOT_FOUND');
    const delB = await asAtt(DEL, { id: byB.id });
    expect(delB.data.deleteCommercialReminder.errors[0].code).toBe('NOT_FOUND');
    const delMgr = await asAtt(DEL, { id: onDealA.id });
    expect(delMgr.data.deleteCommercialReminder.errors[0].code).toBe('FORBIDDEN_ROLE');
    const edit = await asAtt(COMPLETE, { id: onDealA.id, c: true });
    expect(edit.data.completeCommercialReminder.errors).toEqual([]);

    const own = await asAtt(CREATE, { i: { title: 'minha', dueAt: inHours(1) } });
    const ownId = own.data.createCommercialReminder.reminder.id;
    expect((await asAtt(DEL, { id: ownId })).data.deleteCommercialReminder.ok).toBe(true);
    expect((await asManager(DEL, { id: byB.id })).data.deleteCommercialReminder.ok).toBe(true);
    expect((await asAttB(LIST)).errors).toBeUndefined();
  });

  it('PROFESSIONAL recebe FORBIDDEN', async () => {
    expect(isForbidden(await asPro(LIST))).toBe(true);
    expect(isForbidden(await asPro(CREATE, { i: { title: 'a', dueAt: inHours(1) } }))).toBe(true);
  });

  it('claimDueRemindersForOrg reivindica uma vez; concluído e futuro não entram', async () => {
    await adminPrisma.commercialReminder.deleteMany({ where: { organizationId: w.orgId } });
    const due = await mk({ dueAt: new Date(Date.now() - 60_000) });
    const done = await mk({ dueAt: new Date(Date.now() - 60_000), completedAt: new Date() });
    const future = await mk({ dueAt: new Date(Date.now() + H) });
    const first = await svc.claimDueRemindersForOrg(w.orgId, new Date());
    expect(first.map((r) => r.id)).toEqual([due.id]);
    expect(await svc.claimDueRemindersForOrg(w.orgId, new Date())).toEqual([]);
    const row = await adminPrisma.commercialReminder.findUniqueOrThrow({ where: { id: due.id } });
    expect(row.notifiedAt).not.toBeNull();
    for (const id of [done.id, future.id]) {
      const r = await adminPrisma.commercialReminder.findUniqueOrThrow({ where: { id } });
      expect(r.notifiedAt).toBeNull();
    }
    // reagendado volta a ser reivindicável
    await asManager(UPDATE, {
      i: { id: due.id, dueAt: new Date(Date.now() - 1000).toISOString() },
    });
    expect((await svc.claimDueRemindersForOrg(w.orgId, new Date())).map((r) => r.id)).toEqual([
      due.id,
    ]);
  });

  it('tick enfileira um push por lembrete vencido, uma vez só', async () => {
    await adminPrisma.commercialReminder.deleteMany({ where: { organizationId: w.orgId } });
    const a = await mk({ dueAt: new Date(Date.now() - 60_000) });
    const b = await mk({ dueAt: new Date(Date.now() - 30_000) });
    const enqueue = jest.spyOn(w.app.get(PushEventsService), 'enqueue').mockImplementation();
    try {
      await svc.tick(new Date());
      const mine = enqueue.mock.calls
        .map((c) => c[0])
        .filter((j) => j.kind === 'commercial.reminder' && j.orgId === w.orgId);
      expect(mine.map((j) => (j as { reminderId: string }).reminderId).sort()).toEqual(
        [a.id, b.id].sort(),
      );
      enqueue.mockClear();
      await svc.tick(new Date());
      const again = enqueue.mock.calls
        .map((c) => c[0])
        .filter((j) => j.kind === 'commercial.reminder' && j.orgId === w.orgId);
      expect(again).toEqual([]);
    } finally {
      enqueue.mockRestore();
    }
  });
});
