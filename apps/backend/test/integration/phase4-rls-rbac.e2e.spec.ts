import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { adminPrisma, appPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  makeContractReady,
  attachPackage,
  type Phase4World,
} from './helpers/phase4-fixtures';

const PNG_PATH = join(
  __dirname,
  '../../../../.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-papel-timbrado-studio-js.png',
);

const VALID_CPF = '529.982.247-25';

const PHASE4_TABLES = [
  'contract_settings',
  'bridal_groups',
  'bridal_group_members',
  'bridal_member_services',
  'contract_sequences',
  'contracts',
  'contract_items',
  'contract_versions',
  'contract_access_tokens',
  'contract_acceptances',
  'contract_payments',
  'ai_schedule_suggestions',
  'contract_alert_runs',
  'contract_deposit_installments',
  'contract_letterheads',
] as const;

const SET_SERVICES = `mutation($m: UUID!, $s: [BridalMemberServiceInput!]!) {
  setBridalMemberServices(memberId: $m, services: $s) { errors { code message } }
}`;
const CREATE = `mutation($input: CreateContractInput!) {
  createContract(input: $input) { contract { id currentTextSha256 depositAmount } errors { code message } }
}`;
const LINK = `mutation($id: UUID!) { generateContractLink(id: $id) { url errors { code message } } }`;
const PAY = `mutation($input: RecordContractPaymentInput!) {
  recordContractPayment(input: $input) { contract { id } errors { code message } }
}`;
const REVERSE = `mutation($input: ReverseContractPaymentInput!) {
  reverseContractPayment(input: $input) { errors { code message } }
}`;
const CANCEL_CONTRACT = `mutation($input: CancelContractInput!) {
  cancelContract(input: $input) { errors { code message } }
}`;
const SUGGEST = `mutation($groupId: UUID!) {
  suggestBridalSchedule(groupId: $groupId) { suggestion { id source } errors { code message } }
}`;
const CONFIRM = `mutation($input: ConfirmBridalScheduleInput!) {
  confirmBridalSchedule(input: $input) { appointmentIds errors { code message } }
}`;
const SCHEDULE = `mutation($input: ScheduleBridalEventInput!) {
  scheduleBridalEvent(input: $input) { appointmentIds errors { code message } }
}`;
const CREATE_GROUP = `mutation($input: CreateBridalGroupInput!) {
  createBridalGroup(input: $input) { group { id } errors { code message } }
}`;
const CANCEL_GROUP = `mutation($input: CancelBridalGroupInput!) {
  cancelBridalGroup(input: $input) { errors { code message } }
}`;
const GROUPS = `query { bridalGroups { id } }`;
const CONTRACTS = `query { contracts { id } }`;
const SETTINGS = `query { contractSettings { balanceDueDaysBefore } }`;
const UPDATE_SETTINGS = `mutation($input: UpdateContractSettingsInput!) {
  updateContractSettings(input: $input) { errors { code message } }
}`;
const READINESS = `query($id: UUID!) { contractReadiness(id: $id) { ready } }`;
const UPLOAD_LH = `mutation($input: UploadContractLetterheadInput!) {
  uploadContractLetterhead(input: $input) { settings { letterhead { sha256 } } errors { code message } }
}`;
const REMOVE_LH = `mutation { removeContractLetterhead { errors { code message } } }`;
const PDF = `query($id: UUID!) { contractPdf(id: $id) { filename } }`;
const RUN_NOW = `mutation { runContractAlertsNow { ran candidates created resolved emailed } }`;
const CONTRACT_BY_ID = `query($id: UUID!) { contract(id: $id) { id } }`;
const GROUP_BY_ID = `query($id: UUID!) { bridalGroup(id: $id) { id } }`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];

function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

describe('Phase 4 - RLS e RBAC transversais', () => {
  let w: Phase4World;
  let groupId: string;
  let brideMemberId: string;
  let contractId: string;
  let token: string;
  let textSha: string;

  beforeAll(async () => {
    w = await createPhase4World('p4rls');
    const admin = gqlAs(w, w.tokens.admin);

    // alertas e settings: linhas em contract_settings e contract_alert_runs
    const st = await admin(UPDATE_SETTINGS, { input: { balanceDueDaysBefore: 10 } });
    expect(st.data.updateContractSettings.errors).toEqual([]);

    const grp = await insertBridalGroupRow(w, { companions: 1, eventDate: localDay(40) });
    groupId = grp.groupId;
    await makeContractReady(w, grp);
    brideMemberId = grp.brideMemberId;
    const svc = await admin(SET_SERVICES, {
      m: brideMemberId,
      s: [{ serviceId: w.serviceId }],
    });
    expect(svc.data.setBridalMemberServices.errors).toEqual([]);

    const lh = await admin(UPLOAD_LH, {
      input: {
        filename: 'timbrado.png',
        mimeType: 'image/png',
        base64: readFileSync(PNG_PATH).toString('base64'),
      },
    });
    expect(lh.data.uploadContractLetterhead.errors).toEqual([]);

    const created = await admin(CREATE, {
      input: {
        groupId,
        paymentMode: 'sinal_parcelado',
        depositAmount: '300.00',
        installments: [
          { dueDate: localDay(5), amount: '100.00' },
          { dueDate: localDay(20), amount: '200.00' },
        ],
        items: [{ groupMemberId: brideMemberId, serviceId: w.serviceId, unitPrice: '1000.00' }],
      },
    });
    expect(created.data.createContract.errors).toEqual([]);
    contractId = created.data.createContract.contract.id;
    textSha = created.data.createContract.contract.currentTextSha256;

    await attachPackage(w, contractId);
    const link = await admin(LINK, { id: contractId });
    expect(link.data.generateContractLink.errors).toEqual([]);
    // o link pode criar versão nova (D-18): usar o hash da versão vigente
    const cur = await adminPrisma.contract.findUniqueOrThrow({ where: { id: contractId } });
    const ver = await adminPrisma.contractVersion.findFirstOrThrow({
      where: { contractId, version: cur.currentVersion },
    });
    textSha = ver.textSha256;
    token = (link.data.generateContractLink.url as string).split('/').pop() as string;

    const acc = await request(w.app.getHttpServer())
      .post(`/public/contracts/${w.orgId}/${token}/accept`)
      .set('X-Forwarded-For', '198.51.100.77')
      .send({ fullName: 'Noiva Teste', cpf: VALID_CPF, accepted: true, textSha256: textSha });
    expect(acc.status).toBeLessThan(300);

    const pay = await admin(PAY, {
      input: { contractId, lines: [{ method: 'pix', amount: '300.00' }] },
    });
    expect(pay.data.recordContractPayment.errors).toEqual([]);

    const sug = await admin(SUGGEST, { groupId });
    expect(sug.data.suggestBridalSchedule.errors).toEqual([]);

    const run = await admin(RUN_NOW);
    expect(run.errors).toBeUndefined();
    expect(run.data.runContractAlertsNow.ran).toBe(true);
    // a execucao manual e forcada e nao grava a marca diaria; o tick agendado grava
    await adminPrisma.$executeRawUnsafe(
      `INSERT INTO contract_alert_runs (organization_id, run_date) VALUES ('${w.orgId}', CURRENT_DATE) ON CONFLICT DO NOTHING`,
    );
  }, 90_000);

  afterAll(async () => {
    await destroyPhase4World(w);
  });

  describe('RLS: org B nao enxerga nada da org A', () => {
    it.each(PHASE4_TABLES.map((t) => [t]))('%s: org A tem linhas, org B enxerga 0', async (table) => {
      const rowsA = await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id = '${w.orgId}'`,
      );
      expect([table, Number(rowsA[0].n) > 0]).toEqual([table, true]);

      const asB = await appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.current_organization', '${w.otherOrgId}', true)`,
        );
        return tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id = '${w.orgId}'`,
        );
      });
      expect([table, Number(asB[0].n)]).toEqual([table, 0]);

      const asA = await appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.current_organization', '${w.orgId}', true)`,
        );
        return tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id <> '${w.orgId}'`,
        );
      });
      expect([table, Number(asA[0].n)]).toEqual([table, 0]);
    });

    it('INSERT com organization_id da org A na sessao da org B viola a policy (WITH CHECK)', async () => {
      const inserts: Record<string, string> = {
        contract_settings: `INSERT INTO contract_settings (organization_id) VALUES ('${w.orgId}')`,
        bridal_groups: `INSERT INTO bridal_groups (id, organization_id, name, event_date) VALUES ('${randomUUID()}', '${w.orgId}', 'hack', '2031-01-01')`,
        contract_sequences: `INSERT INTO contract_sequences (organization_id, year, last_value) VALUES ('${w.orgId}', 1999, 1)`,
        contract_alert_runs: `INSERT INTO contract_alert_runs (organization_id, run_date) VALUES ('${w.orgId}', '2001-01-01')`,
        contract_deposit_installments: `INSERT INTO contract_deposit_installments (organization_id, contract_id, seq, amount, due_date) VALUES ('${w.orgId}', '${contractId}', 99, 1, '2031-01-01')`,
        contract_letterheads: `INSERT INTO contract_letterheads (organization_id, sha256, mime_type, width, height, size_bytes, data) VALUES ('${w.orgId}', '${'a'.repeat(64)}', 'image/png', 1, 1, 1, '\\x00')`,
      };
      for (const [table, sql] of Object.entries(inserts)) {
        await expect([
          table,
          await appPrisma
            .$transaction(async (tx) => {
              await tx.$executeRawUnsafe(
                `SELECT set_config('app.current_organization', '${w.otherOrgId}', true)`,
              );
              await tx.$executeRawUnsafe(sql);
            })
            .then(() => 'inseriu')
            .catch((e: Error) => (/row-level security|violates/i.test(e.message) ? 'bloqueado' : e.message)),
        ]).toEqual([table, 'bloqueado']);
      }
    });
  });

  describe('GraphQL e rota publica cross-tenant', () => {
    it('admin B: grupo/contrato da org A -> null; listas vazias', async () => {
      const b = gqlAs(w, w.tokens.otherAdmin);
      expect((await b(CONTRACT_BY_ID, { id: contractId })).data.contract).toBeNull();
      expect((await b(GROUP_BY_ID, { id: groupId })).data.bridalGroup).toBeNull();
      expect((await b(CONTRACTS)).data.contracts).toEqual([]);
      expect((await b(GROUPS)).data.bridalGroups).toEqual([]);
      expect((await b(PDF, { id: contractId })).data?.contractPdf ?? null).toBeNull();
    });

    it('admin B: mutations sobre registros da org A -> NOT_FOUND', async () => {
      const b = gqlAs(w, w.tokens.otherAdmin);
      const link = await b(LINK, { id: contractId });
      expect(link.data.generateContractLink.errors[0].code).toBe('NOT_FOUND');
      const pay = await b(PAY, {
        input: { contractId, lines: [{ method: 'pix', amount: '10.00' }] },
      });
      expect(pay.data.recordContractPayment.errors[0].code).toBe('NOT_FOUND');
      const cancel = await b(CANCEL_CONTRACT, {
        input: { contractId, party: 'client', reason: 'cross-tenant' },
      });
      expect(cancel.data.cancelContract.errors[0].code).toBe('NOT_FOUND');
      const sug = await b(SUGGEST, { groupId });
      expect(sug.data.suggestBridalSchedule.errors[0].code).toBe('NOT_FOUND');
    });

    it('token da org A com orgId da org B -> 404; com orgId correto -> 200', async () => {
      const http = () => request(w.app.getHttpServer());
      const ok = await http()
        .get(`/public/contracts/${w.orgId}/${token}`)
        .set('X-Forwarded-For', '198.51.100.78');
      expect(ok.status).toBe(200);
      const wrong = await http()
        .get(`/public/contracts/${w.otherOrgId}/${token}`)
        .set('X-Forwarded-For', '198.51.100.79');
      expect(wrong.status).toBe(404);
      const wrongPdf = await http()
        .get(`/public/contracts/${w.otherOrgId}/${token}/pdf`)
        .set('X-Forwarded-For', '198.51.100.80');
      expect(wrongPdf.status).toBe(404);
    });
  });

  describe('Matriz de permissoes por papel', () => {
    type Role = 'admin' | 'manager' | 'attendant' | 'proA';
    const ROLES: Role[] = ['admin', 'manager', 'attendant', 'proA'];
    const missing = () => randomUUID();

    // [operacao, papeis permitidos, execucao]
    const ops: [string, Role[], (g: ReturnType<typeof gqlAs>) => ReturnType<ReturnType<typeof gqlAs>>][] = [
      ['bridalGroups', ['admin', 'manager', 'attendant'], (g) => g(GROUPS)],
      [
        'createBridalGroup',
        ['admin', 'manager', 'attendant'],
        (g) =>
          g(CREATE_GROUP, {
            input: {
              group: { name: 'matriz', eventDate: 'invalida' },
              bride: { newClient: { fullName: 'Noiva Matriz' } },
            },
          }),
      ],
      [
        'scheduleBridalEvent',
        ['admin', 'manager', 'attendant'],
        (g) => g(SCHEDULE, { input: { groupId: missing(), items: [] } }),
      ],
      [
        'cancelBridalGroup',
        ['admin', 'manager'],
        (g) => g(CANCEL_GROUP, { input: { id: missing(), reason: 'matriz' } }),
      ],
      ['suggestBridalSchedule', ['admin', 'manager'], (g) => g(SUGGEST, { groupId: missing() })],
      [
        'confirmBridalSchedule',
        ['admin', 'manager', 'attendant'],
        (g) => g(CONFIRM, { input: { groupId: missing(), items: [] } }),
      ],
      ['contracts', ['admin', 'manager', 'attendant'], (g) => g(CONTRACTS)],
      [
        'createContract',
        ['admin', 'manager'],
        (g) => g(CREATE, { input: { groupId: missing(), items: [] } }),
      ],
      ['generateContractLink', ['admin', 'manager'], (g) => g(LINK, { id: missing() })],
      [
        'recordContractPayment',
        ['admin', 'manager', 'attendant'],
        (g) =>
          g(PAY, { input: { contractId: missing(), lines: [{ method: 'pix', amount: '1.00' }] } }),
      ],
      [
        'reverseContractPayment',
        ['admin', 'manager'],
        (g) => g(REVERSE, { input: { paymentId: missing(), reason: 'matriz' } }),
      ],
      [
        'cancelContract',
        ['admin', 'manager'],
        (g) =>
          g(CANCEL_CONTRACT, { input: { contractId: missing(), party: 'client', reason: 'matriz' } }),
      ],
      ['contractSettings', ['admin', 'manager', 'attendant'], (g) => g(SETTINGS)],
      [
        'updateContractSettings',
        ['admin'],
        (g) => g(UPDATE_SETTINGS, { input: { balanceDueDaysBefore: 10 } }),
      ],
      ['contractReadiness', ['admin', 'manager', 'attendant'], (g) => g(READINESS, { id: contractId })],
      [
        'uploadContractLetterhead',
        ['admin'],
        (g) => g(UPLOAD_LH, { input: { filename: 'x.gif', mimeType: 'image/gif', base64: 'AAAA' } }),
      ],
      ['removeContractLetterhead', ['admin'], (g) => g(REMOVE_LH)],
      ['contractPdf', ['admin', 'manager', 'attendant'], (g) => g(PDF, { id: missing() })],
      ['runContractAlertsNow', ['admin', 'manager'], (g) => g(RUN_NOW)],
    ];

    const rows = ops.flatMap(([op, allowedRoles, run]) =>
      ROLES.map((role) => [role, op, allowedRoles.includes(role), run] as const),
    );

    it('cobre as 19 operacoes x 4 papeis', () => {
      expect(ops.length).toBe(19);
      expect(rows.length).toBe(76);
    });

    it.each(rows.map((r) => [r[0], r[1], r[2], r[3]] as const))(
      '%s / %s -> permitido=%s',
      async (role, _op, allowed, run) => {
        const res = await run(gqlAs(w, w.tokens[role]));
        if (allowed) {
          expect(isForbidden(res)).toBe(false);
          expect(res.errors).toBeUndefined();
        } else {
          expect(isForbidden(res)).toBe(true);
        }
      },
    );
  });
});
