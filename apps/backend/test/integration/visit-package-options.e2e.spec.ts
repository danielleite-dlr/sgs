import { adminPrisma } from './setup';
import { gqlAs, insertBridalGroupRow, insertContractRow } from './helpers/phase4-fixtures';
import {
  createPhase91World,
  destroyPhase91World,
  type Phase91World,
} from './helpers/phase91-fixtures';

// quick 261126-w01: pacotes do agendamento avulso dependem do contrato da cliente na data.
const OPTIONS = `query($c: UUID, $d: String!) { visitPackageOptions(clientId: $c, date: $d) { id name } }`;
const CREATE = `mutation($i: CreatePackageInput!) { createPackage(input: $i) {
  package { id } errors { code } } }`;

describe('visitPackageOptions — pacote de noiva só no dia do contrato', () => {
  let w: Phase91World;
  let socialId: string;
  let brideClientId: string;
  let companionClientId: string;
  let contractId: string;
  const EVENT = '2031-03-15';
  const ORGS = `SELECT id FROM organizations WHERE legal_name LIKE 'p91v-%'`;

  const ids = async (clientId: string | null, date: string) => {
    const r = await gqlAs(w, w.tokens.attendant)(OPTIONS, { c: clientId, d: date });
    expect(r.errors).toBeUndefined();
    return (r.data.visitPackageOptions as Array<{ id: string }>).map((p) => p.id);
  };

  beforeAll(async () => {
    w = await createPhase91World('p91v');
    const created = await gqlAs(w, w.tokens.admin)(CREATE, {
      i: { name: 'p91v-social', price: '450.00', services: [{ serviceId: w.serviceId }] },
    });
    expect(created.data.createPackage.errors).toEqual([]);
    socialId = created.data.createPackage.package.id;

    const g = await insertBridalGroupRow(w, { eventDate: EVENT, companions: 1 });
    brideClientId = g.brideClientId;
    companionClientId = g.companionClientIds[0];
    await adminPrisma.bridalGroup.update({
      where: { id: g.groupId },
      data: { packageId: w.bridalPackageId },
    });
    const c = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId,
      totalAmount: '2000.00',
      depositAmount: '300.00',
    });
    contractId = c.contractId;
    await adminPrisma.contract.update({
      where: { id: contractId },
      data: { packageId: w.bridalPackageId },
    });
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM contract_settings WHERE organization_id IN (${ORGS})`,
    );
    await destroyPhase91World(w);
  });

  it('noiva com contrato, na data do evento: só o pacote do contrato', async () => {
    expect(await ids(brideClientId, EVENT)).toEqual([w.bridalPackageId]);
  });

  it('noiva em outra data: social, sem o pacote de noiva', async () => {
    const r = await ids(brideClientId, '2031-03-10');
    expect(r).toContain(socialId);
    expect(r).not.toContain(w.bridalPackageId);
  });

  it('acompanhante no dia do evento e cliente sem contrato: só sociais', async () => {
    for (const [c, d] of [
      [companionClientId, EVENT],
      [null, EVENT],
    ] as const) {
      const r = await ids(c, d);
      expect(r).toContain(socialId);
      expect(r).not.toContain(w.bridalPackageId);
    }
  });

  it('contrato cancelado volta a ser social', async () => {
    await adminPrisma.contract.update({
      where: { id: contractId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
    const r = await ids(brideClientId, EVENT);
    expect(r).toContain(socialId);
    expect(r).not.toContain(w.bridalPackageId);
  });
});
