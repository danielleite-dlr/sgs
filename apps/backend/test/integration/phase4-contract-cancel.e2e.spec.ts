import request from 'supertest';
import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  makeContractReady,
  attachPackage,
  insertContractRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const FIELDS = `id status paid cancelledByParty cancelReason
  payments { id kind method amount }`;
const SCHEDULE = `mutation($input: ScheduleBridalEventInput!) {
  scheduleBridalEvent(input: $input) { appointmentIds errors { code message field } }
}`;
const CREATE_CONTRACT = `mutation($input: CreateContractInput!) {
  createContract(input: $input) { contract { id } errors { code message field } }
}`;
const LINK = `mutation($id: UUID!) { generateContractLink(id: $id) { url errors { code message } } }`;
const PAY = `mutation($input: RecordContractPaymentInput!) {
  recordContractPayment(input: $input) { contract { ${FIELDS} } errors { code message field } }
}`;
const PREVIEW = `query($id: UUID!, $p: String!) {
  contractCancellationPreview(contractId: $id, party: $p) { paid retained refund party }
}`;
const CANCEL = `mutation($input: CancelContractInput!) {
  cancelContract(input: $input) { contract { ${FIELDS} } errors { code message field } }
}`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
/** Horário local de São Paulo (UTC-3) como instante ISO. */
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

let ipSeq = 0;
const freshIp = () => `203.0.113.${(++ipSeq % 250) + 1}`;

describe('Fase 4 - cancelamento do contrato com acerto (CONT-03)', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4ccan-%'`;
  const eventDay = localDay(60);

  beforeAll(async () => {
    w = await createPhase4World('p4ccan');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM cash_movements WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const adm = () => gqlAs(w, w.tokens.admin);
  const att = () => gqlAs(w, w.tokens.attendant);

  /** Grupo agendado (noiva coberta + 1 acompanhante avulsa) com contrato e 2.400 pagos. */
  async function setup() {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    await makeContractReady(w, g);
    const sch = await adm()(SCHEDULE, {
      input: {
        groupId: g.groupId,
        items: [
          {
            groupMemberId: g.brideMemberId,
            serviceId: w.serviceId,
            professionalId: w.members.proA,
            startsAt: at(eventDay, 9),
            endsAt: at(eventDay, 10),
          },
          {
            groupMemberId: g.companionMemberIds[0],
            serviceId: w.serviceBId,
            professionalId: w.members.proB,
            startsAt: at(eventDay, 9),
            endsAt: at(eventDay, 10),
          },
        ],
      },
    });
    expect(sch.data.scheduleBridalEvent.errors).toEqual([]);
    const c = await adm()(CREATE_CONTRACT, {
      input: {
        groupId: g.groupId,
        items: [{ groupMemberId: g.brideMemberId, serviceId: w.serviceId, unitPrice: '8000.00' }],
        depositAmount: '2400.00',
      },
    });
    expect(c.data.createContract.errors).toEqual([]);
    const contractId = c.data.createContract.contract.id as string;
    await attachPackage(w, contractId);
    const link = await adm()(LINK, { id: contractId });
    const token = (link.data.generateContractLink.url as string).split('/').pop() as string;
    const p = await adm()(PAY, {
      input: { contractId, lines: [{ method: 'pix', amount: '2400.00' }] },
    });
    expect(p.data.recordContractPayment.errors).toEqual([]);
    return { g, contractId, token };
  }

  it('prévia mostra retido (noiva) ou devolvido (estúdio); exige ADMIN/MANAGER', async () => {
    const { contractId } = await setup();
    const client = await adm()(PREVIEW, { id: contractId, p: 'client' });
    expect(client.data.contractCancellationPreview).toEqual({
      paid: '2400.00',
      retained: '2400.00',
      refund: '0.00',
      party: 'client',
    });
    const studio = await adm()(PREVIEW, { id: contractId, p: 'studio' });
    expect(studio.data.contractCancellationPreview).toMatchObject({
      retained: '0.00',
      refund: '2400.00',
    });
    const denied = await att()(PREVIEW, { id: contractId, p: 'client' });
    expect(denied.errors?.[0].message).toMatch(/permiss|permission|forbidden/i);
  });

  it('exige motivo e permissão; parte inválida é recusada', async () => {
    const { contractId } = await setup();
    const noReason = await adm()(CANCEL, { input: { contractId, party: 'client', reason: ' ' } });
    expect(noReason.data.cancelContract.errors[0].code).toBe('REASON_REQUIRED');
    const denied = await att()(CANCEL, {
      input: { contractId, party: 'client', reason: 'Desistiu do evento' },
    });
    expect(denied.errors?.[0].message).toMatch(/permiss|permission|forbidden/i);
    const bad = await adm()(CANCEL, { input: { contractId, party: 'other', reason: 'Motivo qualquer' } });
    expect(bad.data.cancelContract.errors[0].code).toBe('INVALID_PARTY');
    expect(
      (await adminPrisma.contract.findUniqueOrThrow({ where: { id: contractId } })).status,
    ).not.toBe('cancelled');
  });

  it('cancelamento pela noiva retém tudo, cancela só os agendamentos do contrato e revoga o link', async () => {
    const { g, contractId, token } = await setup();
    const reason = 'Noiva desistiu do casamento';
    const r = await adm()(CANCEL, { input: { contractId, party: 'client', reason } });
    expect(r.data.cancelContract.errors).toEqual([]);
    expect(r.data.cancelContract.contract).toMatchObject({
      status: 'cancelled',
      cancelledByParty: 'client',
      cancelReason: reason,
      paid: '2400.00',
    });
    expect(await adminPrisma.cashMovement.count({ where: { kind: 'contract_refund' } })).toBe(0);

    const bride = await adminPrisma.appointment.findMany({
      where: { bridalGroupId: g.groupId, clientId: g.brideClientId },
    });
    expect(bride).toHaveLength(1);
    expect(bride[0].status).toBe('cancelled');
    expect(bride[0].cancelReason).toContain(reason);
    const companion = await adminPrisma.appointment.findMany({
      where: { bridalGroupId: g.groupId, clientId: g.companionClientIds[0] },
    });
    expect(companion).toHaveLength(1);
    expect(companion[0].status).toBe('scheduled');

    const pub = await request(w.app.getHttpServer())
      .get(`/public/contracts/${w.orgId}/${token}`)
      .set('X-Forwarded-For', freshIp());
    expect(pub.status).toBe(404);

    const again = await adm()(PAY, {
      input: { contractId, lines: [{ method: 'pix', amount: '10.00' }] },
    });
    expect(again.data.recordContractPayment.errors[0].code).toBe('CONTRACT_NOT_PAYABLE');
    const twice = await adm()(CANCEL, {
      input: { contractId, party: 'client', reason: 'Cancelando de novo' },
    });
    expect(twice.data.cancelContract.errors[0].code).toBe('CONTRACT_NOT_CANCELLABLE');

    const audit = await adminPrisma.auditLog.findFirstOrThrow({
      where: { organizationId: w.orgId, action: 'contract.cancel', entityId: contractId },
    });
    expect(audit.metadata).toMatchObject({
      party: 'client',
      paidCents: 240000,
      retainedCents: 240000,
      refundCents: 0,
    });

    // novo contrato para o mesmo grupo é permitido (índice parcial uq_contracts_group_live)
    const fresh = await adm()(CREATE_CONTRACT, {
      input: {
        groupId: g.groupId,
        items: [{ groupMemberId: g.brideMemberId, serviceId: w.serviceId, unitPrice: '1000.00' }],
      },
    });
    expect(fresh.data.createContract.errors).toEqual([]);
    expect(fresh.data.createContract.contract.id).not.toBe(contractId);
  });

  it('cancelamento pelo estúdio devolve tudo, exige forma de devolução e lança saída no caixa', async () => {
    const g = await insertBridalGroupRow(w, { eventDate: eventDay });
    const c = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '5000.00',
      depositAmount: '1500.00',
      status: 'active',
    });
    await adm()(PAY, {
      input: {
        contractId: c.contractId,
        lines: [
          { method: 'pix', amount: '1500.00' },
          { method: 'cash', amount: '900.00' },
        ],
      },
    });

    const noMethod = await adm()(CANCEL, {
      input: { contractId: c.contractId, party: 'studio', reason: 'Estúdio fechou a data' },
    });
    expect(noMethod.data.cancelContract.errors[0].code).toBe('REFUND_METHOD_REQUIRED');
    expect(
      (await adminPrisma.contract.findUniqueOrThrow({ where: { id: c.contractId } })).status,
    ).toBe('active');
    expect(await adminPrisma.contractPayment.count({ where: { kind: 'refund' } })).toBe(0);

    const ok = await adm()(CANCEL, {
      input: {
        contractId: c.contractId,
        party: 'studio',
        reason: 'Estúdio fechou a data',
        refundMethod: 'pix',
      },
    });
    expect(ok.data.cancelContract.errors).toEqual([]);
    expect(ok.data.cancelContract.contract).toMatchObject({
      status: 'cancelled',
      cancelledByParty: 'studio',
      paid: '0.00',
    });
    const refund = await adminPrisma.contractPayment.findFirstOrThrow({
      where: { contractId: c.contractId, kind: 'refund' },
    });
    expect(refund.amount.toString()).toBe('-2400');
    expect(refund.method).toBe('pix');
    const cash = await adminPrisma.cashMovement.findFirstOrThrow({
      where: { contractId: c.contractId, kind: 'contract_refund' },
    });
    expect(cash.amount.toString()).toBe('-2400');

    const audit = await adminPrisma.auditLog.findFirstOrThrow({
      where: { organizationId: w.orgId, action: 'contract.cancel', entityId: c.contractId },
    });
    expect(audit.metadata).toMatchObject({ party: 'studio', refundCents: 240000, retainedCents: 0 });
  });
});
