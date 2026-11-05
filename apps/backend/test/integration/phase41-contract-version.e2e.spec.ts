import { Prisma } from '@prisma/client';
import { adminPrisma } from './setup';
import {
  COMPLETE_CLIENT,
  completeStudioSettings,
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  makeContractReady,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { snapshotHash, type ContractSnapshot } from '../../src/contracts/domain/contract-snapshot';

const FIELDS = `id code currentVersion currentSnapshotFormat currentTextSha256 needsAcceptance`;
const CREATE = `mutation($input: CreateContractInput!) {
  createContract(input: $input) { contract { ${FIELDS} } errors { code message field } }
}`;
const UPDATE = `mutation($id: UUID!, $input: UpdateContractInput!) {
  updateContract(id: $id, input: $input) { contract { ${FIELDS} } errors { code message field } }
}`;
const LINK = `mutation($id: UUID!) {
  generateContractLink(id: $id) { url contract { ${FIELDS} status } errors { code message field } }
}`;
const READY = `query($id: UUID!) {
  contractReadiness(id: $id) { ready missing { code label target targetId } }
}`;
const SETTINGS = `mutation($i: UpdateContractSettingsInput!) {
  updateContractSettings(input: $i) { errors { code } }
}`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

describe('Fase 4.1 - versão do contrato (snapshot, gate e refresh)', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p41ver-%'`;
  const eventDate = localDay(60);

  beforeAll(async () => {
    w = await createPhase4World('p41ver');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
  });

  const g = () => gqlAs(w, w.tokens.admin);

  const versions = (contractId: string) =>
    adminPrisma.contractVersion.findMany({
      where: { contractId },
      orderBy: { version: 'asc' },
    });

  async function packageContract(ready = true) {
    const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
    if (ready) await makeContractReady(w, grp);
    const r = await g()(CREATE, {
      input: { groupId: grp.groupId, packageId: w.bridalPackageId },
    });
    expect(r.data.createContract.errors).toEqual([]);
    return { grp, contract: r.data.createContract.contract as { id: string } };
  }

  it('versão nova grava snapshot formato 2 e o hash do snapshot', async () => {
    const { grp, contract } = await packageContract();
    const [v] = await versions(contract.id);
    expect(v.snapshotFormat).toBe(2);
    const snap = v.snapshot as unknown as ContractSnapshot;
    expect(snap.format).toBe(2);
    expect(snap.budget.package?.name).toBe(`p41ver-pacote-noiva`);
    expect(snap.budget.extras).toEqual([]);
    expect(snap.contractor.cpf).toBe('529.982.247-25');
    expect(v.textSha256).toBe(snapshotHash(snap));
    const view = await g()(`query($id: UUID!) { contract(id: $id) { currentSnapshotFormat } }`, {
      id: contract.id,
    });
    expect(view.data.contract.currentSnapshotFormat).toBe(2);
    expect(grp.groupId).toBeTruthy();
  });

  it('uf_foro vira o nome do estado por extenso nas disposições finais', async () => {
    const { contract } = await packageContract();
    const [v] = await versions(contract.id);
    const snap = v.snapshot as unknown as ContractSnapshot;
    expect(snap.texts.clauses).toContain('Cidade de Osasco, Estado de São Paulo,');
    expect(snap.texts.clauses).not.toContain('Estado de SP');
  });

  it('debutante: contratante é a responsável e debutanteName é a debutante', async () => {
    const resp = await adminPrisma.client.create({
      data: {
        organizationId: w.orgId,
        fullName: 'p41ver-mae-da-debutante',
        ...COMPLETE_CLIENT,
      },
    });
    const grp = await insertBridalGroupRow(w, {
      companions: 0,
      eventDate,
      eventKind: 'debutante',
      responsibleClientId: resp.id,
      eventTime: '20:00',
    });
    await completeStudioSettings(w);
    const r = await g()(CREATE, {
      input: { groupId: grp.groupId, packageId: w.bridalPackageId },
    });
    expect(r.data.createContract.errors).toEqual([]);
    const id = r.data.createContract.contract.id as string;
    const [v] = await versions(id);
    const snap = v.snapshot as unknown as ContractSnapshot;
    expect(snap.kind).toBe('debutante');
    expect(snap.contractor.name).toBe('p41ver-mae-da-debutante');
    expect(snap.debutanteName).toMatch(/^p41ver-noiva-/);
    const row = await adminPrisma.contract.findUniqueOrThrow({ where: { id } });
    expect(row.contractorClientId).toBe(resp.id);
  });

  it('atualizar só o desconto mantém o pacote e põe o rótulo no snapshot', async () => {
    const { contract } = await packageContract();
    const r = await g()(UPDATE, {
      id: contract.id,
      input: { discountAmount: '50.00', discountDescription: '10% OFF' },
    });
    expect(r.data.updateContract.errors).toEqual([]);
    expect(r.data.updateContract.contract.currentVersion).toBe(2);
    const vs = await versions(contract.id);
    const snap = vs[1].snapshot as unknown as ContractSnapshot;
    expect(snap.budget.discount?.label).toBe('10% OFF');
    expect(snap.budget.discount?.cents).toBe(5000);
    expect(snap.budget.package?.name).toBe('p41ver-pacote-noiva');
    expect(snap.budget.package?.cents).toBe(50000);
  });

  describe('gate de campos obrigatórios (D-09)', () => {
    it('bloqueia o link e lista o que falta; contractReadiness devolve os alvos', async () => {
      const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
      await completeStudioSettings(w);
      await adminPrisma.client.update({
        where: { id: grp.brideClientId },
        data: { ...COMPLETE_CLIENT, cpf: null, phone2: null },
      });
      const c = await g()(CREATE, {
        input: { groupId: grp.groupId, packageId: w.bridalPackageId },
      });
      const id = c.data.createContract.contract.id as string;

      const l = await g()(LINK, { id });
      const err = l.data.generateContractLink.errors[0];
      expect(l.data.generateContractLink.url).toBeNull();
      expect(err.code).toBe('CONTRACT_INCOMPLETE');
      expect(err.message).toContain('CPF da contratante');
      expect(err.message).toContain('Celular 2 da contratante');
      expect(err.message).toContain('Horário do evento');

      const ready = await g()(READY, { id });
      const rd = ready.data.contractReadiness;
      expect(rd.ready).toBe(false);
      const byCode = Object.fromEntries(
        rd.missing.map((m: { code: string }) => [m.code, m]),
      ) as Record<string, { target: string; targetId: string | null }>;
      expect(byCode.CONTRACTOR_CPF).toMatchObject({
        target: 'client',
        targetId: grp.brideClientId,
      });
      expect(byCode.CONTRACTOR_PHONE2).toMatchObject({
        target: 'client',
        targetId: grp.brideClientId,
      });
      expect(byCode.EVENT_TIME).toMatchObject({
        target: 'group',
        targetId: grp.groupId,
      });
    });

    it('studio sem cidade/UF do foro gera um único STUDIO_DATA; RG vazio não pendencia', async () => {
      const { contract } = await packageContract();
      await adminPrisma.contractSettings.update({
        where: { organizationId: w.orgId },
        data: { forumCity: null, forumUf: null, studioRepresentativeRg: null },
      });
      const rd = (await g()(READY, { id: contract.id })).data.contractReadiness;
      const studio = rd.missing.filter((m: { code: string }) => m.code === 'STUDIO_DATA');
      expect(studio).toHaveLength(1);
      expect(studio[0].label).toContain('cidade do foro');
      expect(studio[0].label).toContain('UF do foro');
      expect(studio[0].label).not.toContain('RG');
      expect(studio[0].target).toBe('settings');
    });

    it('sinal zerado fora do à vista gera DEPOSIT_ZERO; à vista não', async () => {
      const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
      await makeContractReady(w, grp);
      const c = await g()(CREATE, {
        input: { groupId: grp.groupId, packageId: w.bridalPackageId },
      });
      const id = c.data.createContract.contract.id as string;
      const codes = async () =>
        (
          (await g()(READY, { id })).data.contractReadiness.missing as {
            code: string;
          }[]
        ).map((m) => m.code);
      await adminPrisma.contract.update({
        where: { id },
        data: { paymentMode: 'sinal', depositAmount: '0.00' },
      });
      expect(await codes()).toContain('DEPOSIT_ZERO');
      await adminPrisma.contract.update({
        where: { id },
        data: { paymentMode: 'a_vista' },
      });
      expect(await codes()).not.toContain('DEPOSIT_ZERO');
    });

    it('debutante sem responsável gera RESPONSIBLE_MISSING', async () => {
      const grp = await insertBridalGroupRow(w, {
        companions: 0,
        eventDate,
        eventKind: 'debutante',
        eventTime: '20:00',
      });
      await completeStudioSettings(w);
      const c = await g()(CREATE, {
        input: { groupId: grp.groupId, packageId: w.bridalPackageId },
      });
      const id = c.data.createContract.contract.id as string;
      const rd = (await g()(READY, { id })).data.contractReadiness;
      expect(rd.missing.map((m: { code: string }) => m.code)).toContain('RESPONSIBLE_MISSING');
    });

    it('completo: gera o link; versão legada ganha versão nova; sem mudança não cria; mudança cria', async () => {
      const { grp, contract } = await packageContract();
      // simula versão legada (formato 1) como corrente
      await adminPrisma.contractVersion.update({
        where: {
          uq_cv_contract_version: { contractId: contract.id, version: 1 },
        },
        data: { snapshotFormat: 1, snapshot: Prisma.DbNull },
      });
      const l1 = await g()(LINK, { id: contract.id });
      expect(l1.data.generateContractLink.errors).toEqual([]);
      expect(l1.data.generateContractLink.url).toMatch(/\/aceite\//);
      expect(l1.data.generateContractLink.contract.currentVersion).toBe(2);
      expect(l1.data.generateContractLink.contract.currentSnapshotFormat).toBe(2);

      // sem mudanças: não cria versão
      const l2 = await g()(LINK, { id: contract.id });
      expect(l2.data.generateContractLink.errors).toEqual([]);
      expect(l2.data.generateContractLink.contract.currentVersion).toBe(2);
      expect(await versions(contract.id)).toHaveLength(2);

      // muda o RG da contratante: versão nova
      await adminPrisma.client.update({
        where: { id: grp.brideClientId },
        data: { rg: '99.999.999-9' },
      });
      const l3 = await g()(LINK, { id: contract.id });
      expect(l3.data.generateContractLink.errors).toEqual([]);
      expect(l3.data.generateContractLink.contract.currentVersion).toBe(3);
      const vs = await versions(contract.id);
      expect((vs[2].snapshot as unknown as ContractSnapshot).contractor.rg).toBe('99.999.999-9');

      // muda configuração (studio): também cria versão
      await g()(SETTINGS, { i: { studio: { forumCity: 'Barueri' } } });
      const l4 = await g()(LINK, { id: contract.id });
      expect(l4.data.generateContractLink.contract.currentVersion).toBe(4);
    });
  });
});
