import ExcelJS from 'exceljs';
import { adminPrisma } from './setup';
import {
  createPhase9World,
  destroyPhase9World,
  gqlAs,
  insertLeadRow,
  type Phase9World,
} from './helpers/phase9-fixtures';

const ROW_FIELDS = `line fullName phone email kind eventDate source notes assigneeRef
  assigneeWarning assignee { id displayName roleName }
  duplicateOf { type id name }`;
const PREVIEW = `mutation($b: String!, $f: String!) {
  previewCommercialLeadImport(base64: $b, filename: $f) {
    totalRows valid { ${ROW_FIELDS} } invalid { line reason } errors { code }
  }
}`;
const IMPORT = `mutation($b: String!, $f: String!) {
  importCommercialLeads(base64: $b, filename: $f) {
    createdLeads createdDeals linkedClients assignedDeals unassignedDeals skipped errors { code }
  }
}`;
const LEADS = `query { commercialLeads { total items { id fullName } } }`;
const DEALS_OF = `query($id: UUID!) { commercialLead(id: $id) { id fullName } }`;

type Gql = (q: string, v?: Record<string, unknown>) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function sheet(rows: unknown[][]): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Leads');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
}

const HEAD = ['Nome', 'Celular', 'E-mail', 'Tipo', 'Data do evento', 'Origem', 'Responsável'];

describe('fase 9: importação de planilha', () => {
  let w: Phase9World;
  let asManager: Gql;
  let asAttendant: Gql;
  let asAttendantB: Gql;
  let asPro: Gql;
  let attendantBEmail: string;
  let attendantBName: string;
  let proAEmail: string;
  let inactiveEmail: string;
  let n = 0;
  const phone = () => `(11) 9${String(70000000 + ++n * 13).padStart(8, '0')}`;

  beforeAll(async () => {
    w = await createPhase9World('p9imp');
    asManager = gqlAs(w, w.tokens.manager);
    asAttendant = gqlAs(w, w.tokens.attendant);
    asAttendantB = gqlAs(w, w.attendantB.token);
    asPro = gqlAs(w, w.tokens.proA);
    const b = await adminPrisma.member.findUniqueOrThrow({
      where: { id: w.attendantB.memberId },
      include: { user: true },
    });
    attendantBEmail = b.user.email;
    attendantBName = b.displayName;
    const pro = await adminPrisma.member.findUniqueOrThrow({
      where: { id: w.members.proA },
      include: { user: true },
    });
    proAEmail = pro.user.email;
    // membro ATTENDANT inativo
    const role = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ATTENDANT', isSystem: true },
    });
    const u = await adminPrisma.user.create({
      data: {
        email: `p9imp-inativa-${Date.now()}@t.com`,
        fullName: 'p9imp inativa',
        passwordHash: 'x',
      },
    });
    inactiveEmail = u.email;
    await adminPrisma.member.create({
      data: {
        organizationId: w.orgId,
        userId: u.id,
        roleId: role.id,
        displayName: 'p9imp-inativa',
        status: 'inactive',
      },
    });
  });

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  it('prévia: válidas, inválidas, duplicadas e responsável (D-22) com aviso', async () => {
    const client = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Cliente Existente', phone: '(11) 95555-0001' },
    });
    const leadPhone = '(11) 95555-0002';
    const leadId = await insertLeadRow(w, { fullName: 'Lead Existente', phone: leadPhone });
    const accent = attendantBName.toUpperCase();
    const b64 = await sheet([
      HEAD,
      ['Casa Email', phone(), '', 'noiva', '10/05/2027', 'instagram', attendantBEmail],
      ['Casa Nome', phone(), '', '', '', '', accent],
      ['Sem Match', phone(), '', '', '', '', 'Fulana Inexistente'],
      ['Profissional', phone(), '', '', '', '', proAEmail],
      ['Inativa', phone(), '', '', '', '', inactiveEmail],
      ['Sem Coluna', phone(), '', '', '', '', ''],
      ['Dup Cliente', '11955550001', '', '', '', '', ''],
      ['Dup Lead', leadPhone, '', '', '', '', ''],
      ['', phone(), '', '', '', '', ''],
    ]);
    const res = (await asManager(PREVIEW, { b: b64, f: 'x.xlsx' })).data
      .previewCommercialLeadImport;
    expect(res.errors).toEqual([]);
    expect(res.totalRows).toBe(9);
    expect(res.invalid).toEqual([{ line: 10, reason: 'Nome obrigatório' }]);
    const by = (name: string) => res.valid.find((r: { fullName: string }) => r.fullName === name);
    expect(by('Casa Email').assignee.id).toBe(w.attendantB.memberId);
    expect(by('Casa Email').assigneeWarning).toBeNull();
    expect(by('Casa Nome').assignee.id).toBe(w.attendantB.memberId);
    expect(by('Sem Match').assignee).toBeNull();
    expect(by('Sem Match').assigneeWarning).toBe('responsável não encontrado: Fulana Inexistente');
    expect(by('Profissional').assignee).toBeNull();
    expect(by('Profissional').assigneeWarning).toBe(`responsável não encontrado: ${proAEmail}`);
    expect(by('Inativa').assignee).toBeNull();
    expect(by('Inativa').assigneeWarning).toContain('responsável não encontrado');
    expect(by('Sem Coluna').assignee).toBeNull();
    expect(by('Sem Coluna').assigneeWarning).toBeNull();
    expect(by('Dup Cliente').duplicateOf).toEqual({
      type: 'client',
      id: client.id,
      name: 'Cliente Existente',
    });
    expect(by('Dup Lead').duplicateOf).toEqual({
      type: 'lead',
      id: leadId,
      name: 'Lead Existente',
    });
  });

  it('importação: cria leads e negócios, liga cliente, pula lead duplicado; visibilidade por responsável', async () => {
    const client = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Cliente Imp', phone: '(11) 94444-0001' },
    });
    const dupPhone = '(11) 94444-0002';
    await insertLeadRow(w, { fullName: 'Lead Já Existe', phone: dupPhone });
    const b64 = await sheet([
      HEAD,
      ['Para B', phone(), '', 'noiva', '2027-05-10', 'instagram', attendantBEmail],
      ['Sem Resp', phone(), '', 'debutante', '', '', 'Fulana Inexistente'],
      ['So Lead', phone(), '', '', '', '', attendantBEmail],
      ['Cli Ligada', '11944440001', '', '', '', '', ''],
      ['Lead Dup', dupPhone, '', '', '', '', ''],
    ]);
    const res = (await asManager(IMPORT, { b: b64, f: 'x.xlsx' })).data.importCommercialLeads;
    expect(res).toEqual({
      createdLeads: 4,
      createdDeals: 2,
      linkedClients: 1,
      assignedDeals: 1,
      unassignedDeals: 1,
      skipped: 1,
      errors: [],
    });

    const paraB = await adminPrisma.commercialLead.findFirstOrThrow({
      where: { organizationId: w.orgId, fullName: 'Para B' },
      include: { deals: { include: { stage: true } } },
    });
    expect(paraB.source).toBe('instagram');
    expect(paraB.createdBy).toBe(w.attendantB.memberId);
    expect(paraB.deals).toHaveLength(1);
    expect(paraB.deals[0].assigneeMemberId).toBe(w.attendantB.memberId);
    expect(paraB.deals[0].stage.name).toBe('Novo');
    expect(paraB.deals[0].eventDate?.toISOString().slice(0, 10)).toBe('2027-05-10');

    const semResp = await adminPrisma.commercialLead.findFirstOrThrow({
      where: { organizationId: w.orgId, fullName: 'Sem Resp' },
      include: { deals: true },
    });
    expect(semResp.createdBy).toBeNull();
    expect(semResp.source).toBe('import');
    expect(semResp.deals[0].assigneeMemberId).toBeNull();
    expect(semResp.deals[0].kind).toBe('debutante');

    const soLead = await adminPrisma.commercialLead.findFirstOrThrow({
      where: { organizationId: w.orgId, fullName: 'So Lead' },
      include: { deals: true },
    });
    expect(soLead.deals).toHaveLength(0);
    expect(soLead.createdBy).toBe(w.attendantB.memberId);

    const cli = await adminPrisma.commercialLead.findFirstOrThrow({
      where: { organizationId: w.orgId, fullName: 'Cli Ligada' },
    });
    expect(cli.clientId).toBe(client.id);

    // visibilidade (D-20/D-22)
    const names = async (gql: Gql) =>
      (await gql(LEADS)).data.commercialLeads.items.map((i: { fullName: string }) => i.fullName);
    const forB = await names(asAttendantB);
    expect(forB).toEqual(expect.arrayContaining(['Para B', 'So Lead']));
    expect(forB).not.toContain('Sem Resp');
    const forA = await names(asAttendant);
    expect(forA).not.toContain('Para B');
    expect(forA).not.toContain('So Lead');
    expect(forA).not.toContain('Sem Resp');
    const forManager = await names(asManager);
    expect(forManager).toEqual(expect.arrayContaining(['Para B', 'Sem Resp', 'So Lead']));
    const viaB = await asAttendantB(DEALS_OF, { id: paraB.id });
    expect(viaB.data.commercialLead.fullName).toBe('Para B');
  });

  it('ATTENDANT importa e o responsável vem da planilha, não de quem importa', async () => {
    const b64 = await sheet([
      HEAD,
      ['Importada Por A', phone(), '', 'noiva', '', '', attendantBEmail],
      ['Sem Dono Por A', phone(), '', 'noiva', '', '', 'Fulana Inexistente'],
    ]);
    const pv = (await asAttendant(PREVIEW, { b: b64, f: 'a.xlsx' })).data
      .previewCommercialLeadImport;
    expect(pv.valid[0].assignee.id).toBe(w.attendantB.memberId);
    expect(pv.valid[1].assigneeWarning).toBe('responsável não encontrado: Fulana Inexistente');
    const res = (await asAttendant(IMPORT, { b: b64, f: 'a.xlsx' })).data.importCommercialLeads;
    expect(res.createdLeads).toBe(2);
    expect(res.assignedDeals).toBe(1);
    expect(res.unassignedDeals).toBe(1);
    const lead = await adminPrisma.commercialLead.findFirstOrThrow({
      where: { organizationId: w.orgId, fullName: 'Sem Dono Por A' },
      include: { deals: true },
    });
    expect(lead.createdBy).toBeNull();
    expect(lead.deals[0].assigneeMemberId).toBeNull();
  });

  it('sem gravação parcial quando algo falha no meio', async () => {
    const before = await adminPrisma.commercialLead.count({ where: { organizationId: w.orgId } });
    // arquivo inválido não grava nada
    const res = (
      await asManager(IMPORT, { b: Buffer.from('lixo').toString('base64'), f: 'a.xlsx' })
    ).data.importCommercialLeads;
    expect(res.errors[0].code).toBe('FILE_TYPE_INVALID');
    expect(res.createdLeads).toBe(0);
    expect(await adminPrisma.commercialLead.count({ where: { organizationId: w.orgId } })).toBe(
      before,
    );
  });

  it('erros de arquivo viram errors; PROFESSIONAL é FORBIDDEN', async () => {
    const csv = Buffer.from('Telefone\n11999990000\n').toString('base64');
    const r = (await asManager(PREVIEW, { b: csv, f: 'a.csv' })).data.previewCommercialLeadImport;
    expect(r.errors[0].code).toBe('HEADER_MISSING');
    const big = Buffer.alloc(2_600_000, 65).toString('base64');
    const r2 = (await asManager(PREVIEW, { b: big, f: 'a.csv' })).data.previewCommercialLeadImport;
    expect(r2.errors[0].code).toBe('FILE_TOO_LARGE');
    const forb = await asPro(PREVIEW, { b: csv, f: 'a.csv' });
    expect(
      `${forb.errors?.[0]?.extensions?.code ?? ''} ${forb.errors?.[0]?.message ?? ''}`,
    ).toMatch(/FORBIDDEN/);
  });
});
