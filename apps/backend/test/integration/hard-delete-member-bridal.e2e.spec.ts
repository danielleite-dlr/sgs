import { createHash, randomUUID } from 'node:crypto';
import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertContractRow,
  type Phase4World,
} from './helpers/phase4-fixtures';

const DELETE_MEMBER = `mutation($id: UUID!) {
  deleteMemberPermanently(id: $id) {
    deletedId openAppointmentCount openComandaCount errors { code message }
  }
}`;
const DELETE_GROUP = `mutation($id: UUID!) {
  deleteBridalGroupPermanently(id: $id) { deletedId errors { code message } }
}`;

const count = async (sql: string): Promise<number> => {
  const rows = await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${sql}`);
  return Number(rows[0].n);
};

const HOUR = 3_600_000;

describe('Exclusão definitiva de profissional e de grupo de noiva', () => {
  let w: Phase4World;
  let seq = 0;
  let secondAdminToken: string;
  const stamp = Date.now();

  beforeAll(async () => {
    w = await createPhase4World('hdmb');
    // segundo ADMIN (mais novo): pode tentar excluir o dono sem cair em CANNOT_DELETE_SELF
    const admin2 = await mkUser('admin2');
    const role = await adminPrisma.role.findFirstOrThrow({ where: { name: 'ADMIN', isSystem: true } });
    await adminPrisma.member.create({
      data: {
        organizationId: w.orgId,
        userId: admin2.id,
        roleId: role.id,
        displayName: 'hdmb-admin2',
      },
    });
    const argon2 = await import('argon2');
    await adminPrisma.user.update({
      where: { id: admin2.id },
      data: { passwordHash: await argon2.hash('password1234', { type: argon2.argon2id }) },
    });
    const request = (await import('supertest')).default;
    const login = await request(w.app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `mutation($i: LoginInput!) { login(input: $i) { accessToken } }`,
        variables: { i: { email: admin2.email, password: 'password1234' } },
      });
    secondAdminToken = login.body.data.login.accessToken;
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });

  const adm = () => gqlAs(w, w.tokens.admin);

  async function mkUser(tag: string) {
    return adminPrisma.user.create({
      data: {
        email: `hdmb-${tag}-${stamp}-${++seq}@t.com`,
        fullName: `hdmb ${tag}`,
        passwordHash: 'x',
        emailVerifiedAt: new Date(),
      },
    });
  }

  async function mkPro(tag: string, orgId = w.orgId) {
    const user = await mkUser(tag);
    const role = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });
    const member = await adminPrisma.member.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        roleId: role.id,
        displayName: `hdmb-${tag}`,
        isProfessional: true,
      },
    });
    return { userId: user.id, memberId: member.id, name: member.displayName };
  }

  // horários distintos por agendamento (a exclusion constraint barra sobreposição por profissional)
  const mkAppt = (professionalId: string, status: string, extra: Record<string, unknown> = {}) => {
    const start = Date.now() + (100 + ++seq * 2) * HOUR;
    return adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: new Date(start),
        endsAt: new Date(start + HOUR),
        status,
        ...extra,
      } as never,
    });
  };

  const mkComanda = (status: 'open' | 'closed', openedBy: string | null = null) =>
    adminPrisma.comanda.create({
      data: {
        organizationId: w.orgId,
        code: `HD-${stamp % 100000}-${++seq}`,
        clientId: w.clientId,
        status,
        openedBy,
        closedAt: status === 'closed' ? new Date() : null,
      },
    });

  const mkItem = (comandaId: string, professionalId: string, extra: Record<string, unknown> = {}) =>
    adminPrisma.comandaItem.create({
      data: {
        organizationId: w.orgId,
        comandaId,
        kind: 'service',
        serviceId: w.serviceId,
        professionalId,
        nameSnapshot: 'item',
        listUnitPrice: '100.00',
        unitPrice: '100.00',
        total: '100.00',
        ...extra,
      } as never,
    });

  it('bloqueia com atendimento agendado e não apaga nada', async () => {
    const p = await mkPro('bloq-appt');
    await mkAppt(p.memberId, 'scheduled');
    const res = await adm()(DELETE_MEMBER, { id: p.memberId });
    const out = res.data.deleteMemberPermanently;
    expect(out.deletedId).toBeNull();
    expect(out.errors[0].code).toBe('MEMBER_HAS_OPEN_WORK');
    expect(out.errors[0].message).toContain('1 atendimento agendado');
    expect(out.openAppointmentCount).toBe(1);
    expect(out.openComandaCount).toBe(0);
    expect(await count(`members WHERE id = '${p.memberId}'`)).toBe(1);
    expect(await count(`appointments WHERE professional_id = '${p.memberId}'`)).toBe(1);
  });

  it('bloqueia com comanda aberta que tem item dela (atendimento já concluído)', async () => {
    const p = await mkPro('bloq-comanda');
    const appt = await mkAppt(p.memberId, 'completed');
    const comanda = await mkComanda('open');
    await mkItem(comanda.id, p.memberId, { appointmentId: appt.id });
    const out = (await adm()(DELETE_MEMBER, { id: p.memberId })).data.deleteMemberPermanently;
    expect(out.deletedId).toBeNull();
    expect(out.errors[0].code).toBe('MEMBER_HAS_OPEN_WORK');
    expect(out.errors[0].message).toContain('1 comanda aberta');
    expect(out.openAppointmentCount).toBe(0);
    expect(out.openComandaCount).toBe(1);
    expect(await count(`members WHERE id = '${p.memberId}'`)).toBe(1);
  });

  it('com só histórico fechado apaga a profissional, o usuário e as dependências', async () => {
    const p = await mkPro('historico');
    const other = w.members.proB;
    const appt = await mkAppt(p.memberId, 'completed');
    const apptOther = await mkAppt(other, 'completed');
    const comanda = await mkComanda('closed', p.memberId);
    const mine = await mkItem(comanda.id, p.memberId, { appointmentId: appt.id, createdBy: p.memberId });
    const theirs = await mkItem(comanda.id, other, { appointmentId: apptOther.id });
    await adminPrisma.appointment.update({ where: { id: appt.id }, data: { comandaId: comanda.id } });
    await adminPrisma.commissionRecord.create({
      data: {
        organizationId: w.orgId,
        comandaId: comanda.id,
        comandaItemId: mine.id,
        memberId: p.memberId,
        kind: 'accrual',
        cycle: 0,
        baseAmount: '100.00',
        chargedAmount: '100.00',
        noRule: true,
        ruleSnapshot: {},
        calculatedAmount: '0.00',
      },
    });
    await adminPrisma.commissionRule.create({
      data: {
        organizationId: w.orgId,
        scopeType: 'member_service',
        memberId: p.memberId,
        serviceId: w.serviceBId,
        kind: 'fixed',
        value: '10',
      } as never,
    });
    await adminPrisma.timeBlock.create({
      data: {
        organizationId: w.orgId,
        professionalId: p.memberId,
        kind: 'folga',
        startsAt: new Date(Date.now() + 48 * HOUR),
        endsAt: new Date(Date.now() + 49 * HOUR),
        createdBy: p.memberId,
      },
    });
    await adminPrisma.notification.create({
      data: { organizationId: w.orgId, memberId: p.memberId, kind: 'teste', payload: {} },
    });
    await adminPrisma.cashMovement.create({
      data: {
        organizationId: w.orgId,
        kind: 'payment_in',
        method: 'pix',
        amount: '100.00',
        comandaId: comanda.id,
        appointmentId: appt.id,
        memberId: p.memberId,
      },
    });
    await adminPrisma.comandaPayment.create({
      data: {
        organizationId: w.orgId,
        comandaId: comanda.id,
        method: 'pix',
        amount: '100.00',
        memberId: p.memberId,
      },
    });
    await adminPrisma.auditLog.create({
      data: {
        organizationId: w.orgId,
        actorMemberId: p.memberId,
        action: 'teste.antigo',
        entityType: 'comanda',
        entityId: comanda.id,
      },
    });
    await adminPrisma.refreshToken.create({
      data: {
        userId: p.userId,
        tokenHash: 'h',
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + HOUR),
      },
    });

    const out = (await adm()(DELETE_MEMBER, { id: p.memberId })).data.deleteMemberPermanently;
    expect(out.errors).toEqual([]);
    expect(out.deletedId).toBe(p.memberId);

    expect(await count(`members WHERE id = '${p.memberId}'`)).toBe(0);
    expect(await count(`users WHERE id = '${p.userId}'`)).toBe(0);
    expect(await count(`refresh_tokens WHERE user_id = '${p.userId}'`)).toBe(0);
    expect(await count(`appointments WHERE id = '${appt.id}'`)).toBe(0);
    expect(await count(`comanda_items WHERE id = '${mine.id}'`)).toBe(0);
    expect(await count(`commission_records WHERE member_id = '${p.memberId}'`)).toBe(0);
    expect(await count(`commission_rules WHERE member_id = '${p.memberId}'`)).toBe(0);
    expect(await count(`time_blocks WHERE professional_id = '${p.memberId}'`)).toBe(0);
    expect(await count(`notifications WHERE member_id = '${p.memberId}'`)).toBe(0);

    // o que é de outras pessoas e o financeiro fechado ficam, sem o vínculo com ela
    expect(await count(`comanda_items WHERE id = '${theirs.id}'`)).toBe(1);
    expect(await count(`appointments WHERE id = '${apptOther.id}'`)).toBe(1);
    expect(await count(`comandas WHERE id = '${comanda.id}' AND opened_by IS NULL`)).toBe(1);
    expect(
      await count(
        `cash_movements WHERE comanda_id = '${comanda.id}' AND member_id IS NULL AND appointment_id IS NULL`,
      ),
    ).toBe(1);
    expect(await count(`comanda_payments WHERE comanda_id = '${comanda.id}' AND member_id IS NULL`)).toBe(1);
    expect(
      await count(`audit_log WHERE action = 'teste.antigo' AND entity_id = '${comanda.id}' AND actor_member_id IS NULL`),
    ).toBe(1);

    const audit = await adminPrisma.auditLog.findFirstOrThrow({
      where: { action: 'member.delete_permanent', entityId: p.memberId },
    });
    expect(audit.actorMemberId).toBe(w.members.admin);
    expect((audit.metadata as { displayName: string }).displayName).toBe(p.name);
  });

  it('mantém o usuário quando ele tem vínculo com outra organização', async () => {
    const p = await mkPro('duas-orgs');
    const role = await adminPrisma.role.findFirstOrThrow({ where: { name: 'PROFESSIONAL', isSystem: true } });
    await adminPrisma.member.create({
      data: {
        organizationId: w.otherOrgId,
        userId: p.userId,
        roleId: role.id,
        displayName: 'hdmb-duas-orgs-b',
      },
    });
    const out = (await adm()(DELETE_MEMBER, { id: p.memberId })).data.deleteMemberPermanently;
    expect(out.deletedId).toBe(p.memberId);
    expect(await count(`members WHERE id = '${p.memberId}'`)).toBe(0);
    expect(await count(`users WHERE id = '${p.userId}'`)).toBe(1);
    expect(await count(`members WHERE user_id = '${p.userId}'`)).toBe(1);
  });

  it('não permite excluir a si mesma nem o dono; id de outra org não existe', async () => {
    const self = (await adm()(DELETE_MEMBER, { id: w.members.admin })).data.deleteMemberPermanently;
    expect(self.errors[0].code).toBe('CANNOT_DELETE_SELF');

    const owner = (await gqlAs(w, secondAdminToken)(DELETE_MEMBER, { id: w.members.admin }))
      .data.deleteMemberPermanently;
    expect(owner.errors[0].code).toBe('CANNOT_DELETE_OWNER');
    expect(await count(`members WHERE id = '${w.members.admin}'`)).toBe(1);

    const foreign = await mkPro('outra-org', w.otherOrgId);
    const out = (await adm()(DELETE_MEMBER, { id: foreign.memberId })).data.deleteMemberPermanently;
    expect(out.errors[0].code).toBe('MEMBER_NOT_FOUND');
    expect(await count(`members WHERE id = '${foreign.memberId}'`)).toBe(1);
  });

  it('só ADMIN exclui profissional', async () => {
    const p = await mkPro('perm');
    const res = await gqlAs(w, w.tokens.manager)(DELETE_MEMBER, { id: p.memberId });
    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await count(`members WHERE id = '${p.memberId}'`)).toBe(1);
  });

  /** Grupo com contrato completo + pagamento + caixa + agendamento + comanda do agendamento. */
  async function buildGroup(contractStatus = 'active') {
    const g = await insertBridalGroupRow(w, { companions: 1 });
    const c = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '500.00',
      depositAmount: '150.00',
      status: contractStatus,
      items: [{ groupMemberId: g.brideMemberId, serviceId: w.serviceId, unitPrice: '500.00' }],
      installments: [{ seq: 1, amount: '150.00', dueDate: '2030-05-01' }],
    });
    const version = await adminPrisma.contractVersion.findFirstOrThrow({
      where: { contractId: c.contractId },
    });
    await adminPrisma.contractAcceptance.create({
      data: {
        organizationId: w.orgId,
        contractId: c.contractId,
        versionId: version.id,
        acceptedName: 'Noiva',
        acceptedCpf: '52998224725',
        ip: '203.0.113.1',
        textSha256: version.textSha256,
      },
    });
    await adminPrisma.contractAccessToken.create({
      data: {
        organizationId: w.orgId,
        contractId: c.contractId,
        versionId: version.id,
        tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        expiresAt: new Date(Date.now() + HOUR),
      },
    });
    const pay = await adminPrisma.contractPayment.create({
      data: {
        organizationId: w.orgId,
        contractId: c.contractId,
        kind: 'payment',
        method: 'pix',
        amount: '150.00',
        memberId: w.members.admin,
      },
    });
    await adminPrisma.contractPayment.create({
      data: {
        organizationId: w.orgId,
        contractId: c.contractId,
        kind: 'reversal',
        method: 'pix',
        amount: '-150.00',
        reversesPaymentId: pay.id,
      },
    });
    await adminPrisma.cashMovement.create({
      data: {
        organizationId: w.orgId,
        kind: 'contract_in',
        method: 'pix',
        amount: '150.00',
        contractId: c.contractId,
        clientId: g.brideClientId,
      },
    });
    const appt = await mkAppt(w.members.proA, 'confirmed', {
      clientId: g.brideClientId,
      bridalGroupId: g.groupId,
      contractId: c.contractId,
    });
    const comanda = await mkComanda('open');
    await mkItem(comanda.id, w.members.proA, { appointmentId: appt.id, contractId: c.contractId });
    await adminPrisma.appointment.update({ where: { id: appt.id }, data: { comandaId: comanda.id } });
    await adminPrisma.timeBlock.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        kind: 'deslocamento',
        bridalGroupId: g.groupId,
        startsAt: new Date(Date.now() + 20 * HOUR),
        endsAt: new Date(Date.now() + 21 * HOUR),
      },
    });
    return { ...g, ...c, apptId: appt.id, comandaId: comanda.id };
  }

  it('exclui o grupo com contrato, pagamento, caixa e agendamentos; as clientes ficam', async () => {
    const g = await buildGroup('active');
    const group = await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: g.groupId } });
    const out = (await adm()(DELETE_GROUP, { id: g.groupId })).data.deleteBridalGroupPermanently;
    expect(out.errors).toEqual([]);
    expect(out.deletedId).toBe(g.groupId);

    const gid = g.groupId;
    const cid = g.contractId;
    expect(await count(`bridal_groups WHERE id = '${gid}'`)).toBe(0);
    expect(await count(`bridal_group_members WHERE group_id = '${gid}'`)).toBe(0);
    expect(await count(`contracts WHERE id = '${cid}'`)).toBe(0);
    for (const t of [
      'contract_items',
      'contract_versions',
      'contract_acceptances',
      'contract_access_tokens',
      'contract_payments',
      'contract_deposit_installments',
      'cash_movements',
    ]) {
      expect(await count(`${t} WHERE contract_id = '${cid}'`)).toBe(0);
    }
    expect(await count(`appointments WHERE id = '${g.apptId}'`)).toBe(0);
    expect(await count(`comandas WHERE id = '${g.comandaId}'`)).toBe(0);
    expect(await count(`time_blocks WHERE bridal_group_id = '${gid}'`)).toBe(0);
    // clientes continuam
    expect(await count(`clients WHERE id IN ('${g.brideClientId}', '${g.companionClientIds[0]}')`)).toBe(2);

    const audit = await adminPrisma.auditLog.findFirstOrThrow({
      where: { action: 'bridal.delete_permanent', entityId: gid },
    });
    expect((audit.metadata as { name: string }).name).toBe(group.name);
    expect(audit.actorMemberId).toBe(w.members.admin);
  });

  it('exclui grupo com contrato não cancelado e funciona para a gerente', async () => {
    const g = await buildGroup('awaiting_acceptance');
    const out = (await gqlAs(w, w.tokens.manager)(DELETE_GROUP, { id: g.groupId })).data
      .deleteBridalGroupPermanently;
    expect(out.deletedId).toBe(g.groupId);
    expect(await count(`bridal_groups WHERE id = '${g.groupId}'`)).toBe(0);
  });

  it('recusa grupo cuja comanda tem item de outro atendimento', async () => {
    const g = await buildGroup();
    const foreignAppt = await mkAppt(w.members.proB, 'confirmed');
    await mkItem(g.comandaId, w.members.proB, { appointmentId: foreignAppt.id });
    const out = (await adm()(DELETE_GROUP, { id: g.groupId })).data.deleteBridalGroupPermanently;
    expect(out.deletedId).toBeNull();
    expect(out.errors[0].code).toBe('BRIDAL_SHARED_COMANDA');
    expect(await count(`bridal_groups WHERE id = '${g.groupId}'`)).toBe(1);
    expect(await count(`contracts WHERE id = '${g.contractId}'`)).toBe(1);
  });

  it('RLS: outra organização não exclui grupo; atendente não tem permissão', async () => {
    const g = await buildGroup();
    const other = (await gqlAs(w, w.tokens.otherAdmin)(DELETE_GROUP, { id: g.groupId })).data
      .deleteBridalGroupPermanently;
    expect(other.deletedId).toBeNull();
    expect(other.errors[0].code).toBe('NOT_FOUND');
    const att = await gqlAs(w, w.tokens.attendant)(DELETE_GROUP, { id: g.groupId });
    expect(att.errors?.length).toBeGreaterThan(0);
    expect(await count(`bridal_groups WHERE id = '${g.groupId}'`)).toBe(1);

    const p = await mkPro('rls-member');
    const otherMember = (await gqlAs(w, w.tokens.otherAdmin)(DELETE_MEMBER, { id: p.memberId })).data
      .deleteMemberPermanently;
    expect(otherMember.errors[0].code).toBe('MEMBER_NOT_FOUND');
    expect(await count(`members WHERE id = '${p.memberId}'`)).toBe(1);
  });

  it('purge_member/purge_bridal_group abortam sem tenant e não são executáveis por PUBLIC', async () => {
    await expect(
      adminPrisma.$queryRawUnsafe(`SELECT purge_member('${w.members.proA}'::uuid)`),
    ).rejects.toThrow(/tenant ausente/);
    await expect(
      adminPrisma.$queryRawUnsafe(`SELECT purge_bridal_group('${randomUUID()}'::uuid)`),
    ).rejects.toThrow(/tenant ausente/);
    const rows = await adminPrisma.$queryRawUnsafe<{ pub: boolean; app: boolean }[]>(
      `SELECT has_function_privilege('public', 'purge_member(uuid)', 'EXECUTE') AS pub,
              has_function_privilege('sgs_app', 'purge_member(uuid)', 'EXECUTE') AS app`,
    );
    expect(rows[0]).toEqual({ pub: false, app: true });
  });
});
