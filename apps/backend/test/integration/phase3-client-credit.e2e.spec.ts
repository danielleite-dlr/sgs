import { adminPrisma, appPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { ClientCreditService } from '../../src/financial/client-credit.service';
import {
  CreditError,
  getCreditBalanceCents,
  lockClient,
  recordCreditMovement,
} from '../../src/financial/client-credit';

describe('Phase 3 - crédito de cliente', () => {
  let w: Phase3World;
  let tenant: TenantContextService;
  let svc: ClientCreditService;

  beforeAll(async () => {
    w = await createPhase3World('p3cred');
    tenant = w.app.get(TenantContextService);
    svc = w.app.get(ClientCreditService);
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(`SELECT id FROM organizations WHERE legal_name LIKE 'p3cred-%'`);
  });

  const move = (amountCents: number, kind: 'deposit' | 'consumption') =>
    tenant.runWithTenant(w.orgId, async (tx) => {
      await lockClient(tx, w.clientId);
      await recordCreditMovement(tx, {
        orgId: w.orgId,
        clientId: w.clientId,
        amountCents,
        kind,
        createdBy: w.members.admin,
      });
    });
  const balance = () =>
    tenant.runWithTenant(w.orgId, (tx) => getCreditBalanceCents(tx, w.clientId));

  it('soma movimentos e recusa saldo negativo sem gravar nada', async () => {
    await move(5000, 'deposit');
    expect(await balance()).toBe(5000);
    await move(-3000, 'consumption');
    expect(await balance()).toBe(2000);
    await expect(move(-3000, 'consumption')).rejects.toMatchObject({
      code: 'CREDIT_INSUFFICIENT',
    });
    await expect(move(-3000, 'consumption')).rejects.toBeInstanceOf(CreditError);
    expect(await balance()).toBe(2000);
    const n = await adminPrisma.clientCreditMovement.count({ where: { clientId: w.clientId } });
    expect(n).toBe(2);
  });

  it('cliente inexistente -> CLIENT_NOT_FOUND', async () => {
    await expect(
      tenant.runWithTenant(w.orgId, (tx) =>
        lockClient(tx, '00000000-0000-4000-8000-000000000000'),
      ),
    ).rejects.toMatchObject({ code: 'CLIENT_NOT_FOUND' });
  });

  it('concorrência: duas transações consumindo 40,00 de 50,00 -> só uma passa', async () => {
    await move(5000, 'deposit');
    const results = await Promise.allSettled([
      move(-4000, 'consumption'),
      move(-4000, 'consumption'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'CREDIT_INSUFFICIENT' });
    expect(await balance()).toBe(1000);
  });

  it('ajuste manual: grava movimento + audit_log; exige motivo; não deixa negativo', async () => {
    const ok = await svc.adjust(w.orgId, w.members.admin, {
      clientId: w.clientId,
      amount: '20.00',
      reason: 'Cortesia',
    });
    expect(ok).toEqual({ balance: '20.00', errors: [] });
    const mov = await adminPrisma.clientCreditMovement.findFirst({
      where: { clientId: w.clientId },
    });
    expect(mov?.kind).toBe('manual_adjustment');
    expect(mov?.createdBy).toBe(w.members.admin);
    const audit = await adminPrisma.auditLog.findFirst({
      where: { organizationId: w.orgId, action: 'credit.adjust', entityId: w.clientId },
    });
    expect(audit?.reason).toBe('Cortesia');
    expect(audit?.actorMemberId).toBe(w.members.admin);

    const noReason = await svc.adjust(w.orgId, w.members.admin, {
      clientId: w.clientId,
      amount: '5.00',
      reason: '  ',
    });
    expect(noReason.errors[0].code).toBe('REASON_REQUIRED');

    const neg = await svc.adjust(w.orgId, w.members.admin, {
      clientId: w.clientId,
      amount: '-999.00',
      reason: 'Estorno',
    });
    expect(neg.errors[0].code).toBe('CREDIT_NEGATIVE');

    const bad = await svc.adjust(w.orgId, w.members.admin, {
      clientId: w.clientId,
      amount: '0',
      reason: 'x y z',
    });
    expect(bad.errors[0].code).toBe('INVALID_AMOUNT');
    expect(await balance()).toBe(2000);
  });

  it('balances lista só clientes com saldo > 0; movements em ordem decrescente', async () => {
    const other = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'p3cred-zerado', phone: '+5511988880002' },
    });
    await move(5000, 'deposit');
    await adminPrisma.clientCreditMovement.createMany({
      data: [
        { organizationId: w.orgId, clientId: other.id, amount: '10.00', kind: 'deposit' },
        { organizationId: w.orgId, clientId: other.id, amount: '-10.00', kind: 'consumption' },
      ],
    });
    const list = await svc.balances(w.orgId);
    expect(list).toEqual([
      { clientId: w.clientId, clientName: 'p3cred-cliente', balance: '50.00' },
    ]);
    expect(await svc.balances(w.otherOrgId)).toEqual([]);
    const movs = await svc.movements(w.orgId, w.clientId);
    expect(movs).toHaveLength(1);
    expect(movs[0].amount).toBe('50.00');
    await deletePhase3Rows(`SELECT id FROM organizations WHERE legal_name LIKE 'p3cred-%'`);
    await adminPrisma.client.delete({ where: { id: other.id } });
  });

  it('sgs_app não consegue UPDATE no ledger (append-only)', async () => {
    await move(5000, 'deposit');
    await expect(
      appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${w.orgId}'`);
        await tx.$executeRawUnsafe(`UPDATE client_credit_movements SET amount = 1`);
      }),
    ).rejects.toThrow(/permission denied/i);
  });
});
