import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const SETTINGS_FIELDS = `balanceDueDaysBefore templateBody isDefaultTemplate cancellationClause
  isDefaultClause alertDepositUnpaidDays alertNotAcceptedDays alertCompanionDepositDays
  scheduleDayStart scheduleDayEnd templateVariables missingVariables`;

const UPDATE = `mutation($input: UpdateContractSettingsInput!) {
  updateContractSettings(input: $input) { settings { ${SETTINGS_FIELDS} } errors { code message field } }
}`;

describe('Fase 4 - configurações do contrato e entrada do pacote', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4set-%'`;

  beforeAll(async () => {
    w = await createPhase4World('p4set');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
  });

  it('sem linha devolve os padrões', async () => {
    const r = await gqlAs(w, w.tokens.admin)(`{ contractSettings { ${SETTINGS_FIELDS} } }`);
    expect(r.errors).toBeUndefined();
    const s = r.data.contractSettings;
    expect(s.balanceDueDaysBefore).toBe(10);
    expect(s.isDefaultTemplate).toBe(true);
    expect(s.isDefaultClause).toBe(true);
    expect(s.alertDepositUnpaidDays).toBe(3);
    expect(s.alertNotAcceptedDays).toBe(3);
    expect(s.alertCompanionDepositDays).toBe(15);
    expect(s.scheduleDayStart).toBe('06:00');
    expect(s.scheduleDayEnd).toBe('20:00');
    expect(s.templateVariables).toContain('noiva_nome');
    expect(s.missingVariables).toEqual([]);
  });

  it('variável desconhecida no modelo é rejeitada', async () => {
    const r = await gqlAs(w, w.tokens.admin)(UPDATE, {
      input: { templateBody: 'Olá {{foo}} e {{noiva_nome}}' },
    });
    expect(r.data.updateContractSettings.settings).toBeNull();
    expect(r.data.updateContractSettings.errors[0].code).toBe('UNKNOWN_TEMPLATE_VARIABLE');
    expect(r.data.updateContractSettings.errors[0].message).toContain('foo');
  });

  it('atualização válida persiste e null volta ao padrão', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const ok = await g(UPDATE, {
      input: {
        balanceDueDaysBefore: 15,
        cancellationClause: 'Cláusula própria do estúdio para cancelamento.',
        alertDepositUnpaidDays: 5,
        scheduleDayStart: '07:30',
        scheduleDayEnd: '19:00',
        templateBody: 'Contrato de {{noiva_nome}}',
      },
    });
    expect(ok.data.updateContractSettings.errors).toEqual([]);
    const q = await g(`{ contractSettings { ${SETTINGS_FIELDS} } }`);
    const s = q.data.contractSettings;
    expect(s.balanceDueDaysBefore).toBe(15);
    expect(s.isDefaultClause).toBe(false);
    expect(s.isDefaultTemplate).toBe(false);
    expect(s.alertDepositUnpaidDays).toBe(5);
    expect(s.scheduleDayStart).toBe('07:30');
    expect(s.scheduleDayEnd).toBe('19:00');
    expect(s.missingVariables.length).toBeGreaterThan(0);

    const reset = await g(UPDATE, { input: { templateBody: null, cancellationClause: null } });
    expect(reset.data.updateContractSettings.settings.isDefaultTemplate).toBe(true);
    expect(reset.data.updateContractSettings.settings.isDefaultClause).toBe(true);
    expect(reset.data.updateContractSettings.settings.balanceDueDaysBefore).toBe(15);
  });

  it('valida cláusula, dias e janela do dia', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const codes = async (input: Record<string, unknown>) =>
      (await g(UPDATE, { input })).data.updateContractSettings.errors[0]?.code;
    expect(await codes({ cancellationClause: 'curta' })).toBe('INVALID_CLAUSE');
    expect(await codes({ balanceDueDaysBefore: 400 })).toBe('INVALID_DAYS');
    expect(await codes({ alertDepositUnpaidDays: 91 })).toBe('INVALID_DAYS');
    expect(await codes({ scheduleDayStart: '9h' })).toBe('INVALID_DAY_WINDOW');
    expect(await codes({ scheduleDayStart: '21:00' })).toBe('INVALID_DAY_WINDOW');
  });

  it('MANAGER sem contract.settings não altera', async () => {
    const r = await gqlAs(w, w.tokens.manager)(UPDATE, { input: { balanceDueDaysBefore: 5 } });
    expect(r.errors?.[0].message).toMatch(/permiss|permission|forbidden/i);
    const read = await gqlAs(w, w.tokens.manager)(`{ contractSettings { balanceDueDaysBefore } }`);
    expect(read.errors).toBeUndefined();
  });

  it('a organização B não vê a configuração da A', async () => {
    await gqlAs(w, w.tokens.admin)(UPDATE, { input: { balanceDueDaysBefore: 21 } });
    const r = await gqlAs(w, w.tokens.otherAdmin)(`{ contractSettings { balanceDueDaysBefore } }`);
    expect(r.data.contractSettings.balanceDueDaysBefore).toBe(10);
    const rows = await adminPrisma.contractSettings.count({ where: { organizationId: w.orgId } });
    expect(rows).toBe(1);
  });

  describe('entrada no pacote (D-12)', () => {
    const CREATE = `mutation($input: CreatePackageInput!) {
      createPackage(input: $input) { package { id depositKind depositValue } errors { code field } }
    }`;
    const UPD = `mutation($input: UpdatePackageInput!) {
      updatePackage(input: $input) { package { id depositKind depositValue } errors { code field } }
    }`;

    it('percent 30 persiste, 120 é rejeitado e null limpa', async () => {
      const g = gqlAs(w, w.tokens.admin);
      const ok = await g(CREATE, {
        input: {
          name: 'p4set-pacote',
          price: '1000.00',
          depositKind: 'percent',
          depositValue: '30',
          services: [{ serviceId: w.serviceId }],
        },
      });
      expect(ok.data.createPackage.errors).toEqual([]);
      const pkg = ok.data.createPackage.package;
      expect(pkg.depositKind).toBe('percent');
      expect(pkg.depositValue).toBe('30.00');

      const bad = await g(UPD, {
        input: { id: pkg.id, depositKind: 'percent', depositValue: '120' },
      });
      expect(bad.data.updatePackage.errors[0].code).toBe('INVALID_DEPOSIT');
      expect(bad.data.updatePackage.errors[0].field).toBe('depositValue');

      const half = await g(UPD, { input: { id: pkg.id, depositKind: 'fixed' } });
      expect(half.data.updatePackage.errors[0].code).toBe('INVALID_DEPOSIT');

      const fixed = await g(UPD, {
        input: { id: pkg.id, depositKind: 'fixed', depositValue: '250.5' },
      });
      expect(fixed.data.updatePackage.package.depositValue).toBe('250.50');

      const clear = await g(UPD, { input: { id: pkg.id, depositKind: null } });
      expect(clear.data.updatePackage.package.depositKind).toBeNull();
      expect(clear.data.updatePackage.package.depositValue).toBeNull();
    });
  });
});
