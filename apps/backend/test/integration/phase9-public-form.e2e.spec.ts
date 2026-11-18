import request from 'supertest';
import { adminPrisma } from './setup';
import {
  createPhase9World,
  destroyPhase9World,
  gqlAs,
  type Phase9World,
} from './helpers/phase9-fixtures';

const SETTINGS = `query { commercialFormSettings {
  isActive token publicPath successMessage consentText consentTextVersion
  defaultAssignee { id roleName } } }`;
const UPDATE = `mutation($i: UpdateCommercialFormSettingsInput!) {
  updateCommercialFormSettings(input: $i) {
    settings { isActive consentTextVersion successMessage defaultAssignee { id } }
    errors { code }
  }
}`;
const REGEN = `mutation { regenerateCommercialFormToken { settings { token } errors { code } } }`;
const LEADS = `query { commercialLeads { items { id fullName source } } }`;

type Gql = (q: string, v?: Record<string, unknown>) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('fase 9: formulário público do site', () => {
  let w: Phase9World;
  let asManager: Gql;
  let asAttendant: Gql;
  let token: string;
  let ipSeq = 0;
  const nextIp = () => `198.51.100.${++ipSeq}`;
  let phoneSeq = 0;
  let emailSeq = 0;
  const nextPhone = () => `(21) 9${String(61000000 + ++phoneSeq * 7).padStart(8, '0')}`;

  const path = (t = token, org = w.orgId) => `/public/leads/${org}/${t}`;
  const post = (body: Record<string, unknown>, ip = nextIp(), t = token) =>
    request(w.app.getHttpServer()).post(path(t)).set('X-Forwarded-For', ip).send(body);
  const get = (t = token, org = w.orgId, ip = nextIp()) =>
    request(w.app.getHttpServer()).get(path(t, org)).set('X-Forwarded-For', ip);
  const valid = (over: Record<string, unknown> = {}) => ({
    fullName: 'Visitante Teste',
    phone: nextPhone(),
    email: `visitante-${++emailSeq}@exemplo.com`,
    kind: 'noiva',
    eventDate: '2027-08-20',
    message: 'Quero um orçamento',
    consent: true,
    website: '',
    ...over,
  });

  beforeAll(async () => {
    w = await createPhase9World('p9form');
    asManager = gqlAs(w, w.tokens.manager);
    asAttendant = gqlAs(w, w.tokens.attendant);
    const s = (await asManager(SETTINGS)).data.commercialFormSettings;
    token = s.token;
  });

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  it('configuração: criada na primeira leitura, inativa, token de 43 caracteres; ATTENDANT é FORBIDDEN', async () => {
    const s = (await asManager(SETTINGS)).data.commercialFormSettings;
    expect(s.isActive).toBe(false);
    expect(s.token).toHaveLength(43);
    expect(s.publicPath).toBe(`/contato/${w.orgId}/${s.token}`);
    expect(s.consentTextVersion).toBe('v1');
    const forb = await asAttendant(SETTINGS);
    expect(
      `${forb.errors?.[0]?.extensions?.code ?? ''} ${forb.errors?.[0]?.message ?? ''}`,
    ).toMatch(/FORBIDDEN/);
    const forb2 = await asAttendant(REGEN);
    expect(forb2.errors?.[0]).toBeDefined();
  });

  it('formulário inativo, token errado, org inválida e outra org dão o mesmo 404', async () => {
    const inactive = await get();
    expect(inactive.status).toBe(404);
    expect(inactive.body).toEqual(expect.objectContaining({ code: 'NOT_FOUND' }));
    await asManager(UPDATE, { i: { isActive: true } });
    const wrong = await get('x'.repeat(43));
    const badOrg = await get(token, 'nao-e-uuid');
    const otherOrg = await get(token, w.otherOrgId);
    for (const r of [wrong, badOrg, otherOrg]) {
      expect(r.status).toBe(404);
      expect(r.body).toEqual(inactive.body);
    }
    const ok = await get();
    expect(ok.status).toBe(200);
    expect(ok.headers['cache-control']).toBe('no-store');
    expect(ok.body).toEqual({
      orgName: expect.any(String),
      consentText: expect.any(String),
      consentTextVersion: 'v1',
      successMessage: null,
    });
  });

  it('update: responsável padrão validado, mensagem ≤300, consentimento incrementa a versão', async () => {
    const bad = await asManager(UPDATE, { i: { defaultAssigneeMemberId: w.members.proA } });
    expect(bad.data.updateCommercialFormSettings.errors[0].code).toBe('ASSIGNEE_INVALID');
    const long = await asManager(UPDATE, { i: { successMessage: 'a'.repeat(301) } });
    expect(long.data.updateCommercialFormSettings.errors[0].code).toBe('MESSAGE_TOO_LONG');
    const ok = await asManager(UPDATE, {
      i: { successMessage: 'Obrigada!', consentText: 'Novo texto de consentimento.' },
    });
    const st = ok.data.updateCommercialFormSettings.settings;
    expect(st.consentTextVersion).toBe('v2');
    expect(st.successMessage).toBe('Obrigada!');
    const same = await asManager(UPDATE, { i: { consentText: 'Novo texto de consentimento.' } });
    expect(same.data.updateCommercialFormSettings.settings.consentTextVersion).toBe('v2');
    await asManager(UPDATE, { i: { successMessage: '' } });
  });

  it('POST válido cria lead do site com consentimento e negócio sem responsável; só gestão vê (D-20)', async () => {
    const body = valid({ fullName: 'Lead Do Site' });
    const res = await post(body);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      ok: true,
      message: 'Recebemos seu contato. Em breve falaremos com você.',
    });
    const lead = await adminPrisma.commercialLead.findFirstOrThrow({
      where: { organizationId: w.orgId, fullName: 'Lead Do Site' },
      include: { deals: { include: { stage: true } } },
    });
    expect(lead.source).toBe('site');
    expect(lead.consentAt).not.toBeNull();
    expect(lead.consentTextVersion).toBe('v2');
    expect(lead.createdBy).toBeNull();
    expect(lead.deals).toHaveLength(1);
    expect(lead.deals[0].assigneeMemberId).toBeNull();
    expect(lead.deals[0].source).toBe('site');
    expect(lead.deals[0].notes).toBe('Quero um orçamento');
    expect(lead.deals[0].stage.name).toBe('Novo');

    const names = async (g: Gql) =>
      (await g(LEADS)).data.commercialLeads.items.map((i: { fullName: string }) => i.fullName);
    expect(await names(asManager)).toContain('Lead Do Site');
    expect(await names(asAttendant)).not.toContain('Lead Do Site');
  });

  it('responsável padrão do formulário fica no negócio', async () => {
    await asManager(UPDATE, { i: { defaultAssigneeMemberId: w.attendantB.memberId } });
    const res = await post(valid({ fullName: 'Com Padrão' }));
    expect(res.status).toBe(201);
    const lead = await adminPrisma.commercialLead.findFirstOrThrow({
      where: { organizationId: w.orgId, fullName: 'Com Padrão' },
      include: { deals: true },
    });
    expect(lead.deals[0].assigneeMemberId).toBe(w.attendantB.memberId);
    await asManager(UPDATE, { i: { clearDefaultAssignee: true } });
  });

  it('honeypot: website preenchido responde ok e não grava', async () => {
    const before = await adminPrisma.commercialLead.count({ where: { organizationId: w.orgId } });
    const res = await post(valid({ fullName: 'Robô', website: 'http://spam' }));
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(await adminPrisma.commercialLead.count({ where: { organizationId: w.orgId } })).toBe(
      before,
    );
  });

  it('validações do corpo', async () => {
    const codeOf = async (over: Record<string, unknown>) => {
      const r = await post(valid(over));
      expect(r.status).toBe(400);
      return r.body.code;
    };
    expect(await codeOf({ consent: false })).toBe('CONSENT_REQUIRED');
    expect(await codeOf({ consent: undefined })).toBe('CONSENT_REQUIRED');
    expect(await codeOf({ phone: '1234' })).toBe('PHONE_INVALID');
    expect(await codeOf({ fullName: 'A' })).toBe('NAME_INVALID');
    expect(await codeOf({ fullName: 'A'.repeat(121) })).toBe('NAME_INVALID');
    expect(await codeOf({ message: 'm'.repeat(1001) })).toBe('MESSAGE_TOO_LONG');
    expect(await codeOf({ kind: 'madrinha' })).toBe('KIND_INVALID');
  });

  it('mesmo telefone em menos de 30 min só acrescenta interação', async () => {
    const phone = nextPhone();
    expect((await post(valid({ fullName: 'Repete', phone }))).status).toBe(201);
    expect((await post(valid({ fullName: 'Repete', phone }))).status).toBe(201);
    const leads = await adminPrisma.commercialLead.findMany({
      where: { organizationId: w.orgId, fullName: 'Repete' },
      include: { deals: true, interactions: true },
    });
    expect(leads).toHaveLength(1);
    expect(leads[0].deals).toHaveLength(1);
    expect(leads[0].interactions.map((i) => i.notes)).toEqual([
      'Novo envio pelo formulário do site',
    ]);
    expect(leads[0].interactions[0].type).toBe('other');
  });

  it('lead existente antigo é reusado; negócio novo só sem negócio aberto do mesmo tipo', async () => {
    const phone = nextPhone();
    const old = await adminPrisma.commercialLead.create({
      data: {
        organizationId: w.orgId,
        fullName: 'Antiga',
        phone,
        phoneDigits: phone.replace(/\D/g, ''),
        source: 'manual',
        createdAt: new Date(Date.now() - 3 * 86_400_000),
      },
    });
    expect((await post(valid({ fullName: 'Outro Nome', phone }))).status).toBe(201);
    expect((await post(valid({ fullName: 'Outro Nome', phone, kind: 'noiva' }))).status).toBe(201);
    expect((await post(valid({ fullName: 'Outro Nome', phone, kind: 'debutante' }))).status).toBe(
      201,
    );
    expect(
      await adminPrisma.commercialLead.count({
        where: { organizationId: w.orgId, phoneDigits: phone.replace(/\D/g, '') },
      }),
    ).toBe(1);
    const deals = await adminPrisma.commercialDeal.findMany({ where: { leadId: old.id } });
    expect(deals.map((d) => d.kind).sort()).toEqual(['debutante', 'noiva']);
  });

  it('regenerar o token invalida o antigo', async () => {
    const old = token;
    const fresh = (await asManager(REGEN)).data.regenerateCommercialFormToken.settings.token;
    expect(fresh).not.toBe(old);
    expect((await get(old)).status).toBe(404);
    expect((await get(fresh)).status).toBe(200);
    token = fresh;
  });

  it('não registra telefone nem e-mail em nenhum log', async () => {
    const seen: string[] = [];
    const out = jest.spyOn(process.stdout, 'write').mockImplementation(((c: unknown) => {
      seen.push(String(c));
      return true;
    }) as never);
    const err = jest.spyOn(process.stderr, 'write').mockImplementation(((c: unknown) => {
      seen.push(String(c));
      return true;
    }) as never);
    const { Logger } = await import('@nestjs/common');
    const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) =>
      jest.spyOn(Logger.prototype, m).mockImplementation(((...a: unknown[]) => {
        seen.push(JSON.stringify(a));
      }) as never),
    );
    try {
      const phone = '(31) 98765-4321';
      expect(
        (await post(valid({ fullName: 'Sigilo', phone, email: 'sigilo-unico@exemplo.com' })))
          .status,
      ).toBe(201);
      expect((await post(valid({ phone: '12', email: 'sigilo-unico@exemplo.com' }))).status).toBe(
        400,
      );
    } finally {
      out.mockRestore();
      err.mockRestore();
      spies.forEach((s) => s.mockRestore());
    }
    const all = seen.join('\n');
    expect(all).not.toContain('98765-4321');
    expect(all).not.toContain('987654321');
    expect(all).not.toContain('sigilo-unico@exemplo.com');
  });

  it('6º POST no mesmo minuto do mesmo IP recebe 429', async () => {
    const ip = '203.0.113.77';
    for (let i = 0; i < 5; i++) {
      expect((await post({ ...valid(), consent: false }, ip)).status).toBe(400);
    }
    expect((await post(valid(), ip)).status).toBe(429);
  });
});
