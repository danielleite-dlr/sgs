import { sampleSnapshotInput } from './__fixtures__/snapshot-input';
import {
  buildSnapshot,
  canonicalJson,
  snapshotHash,
  snapshotToPlainText,
  type ContractSnapshot,
} from './contract-snapshot';

describe('canonicalJson', () => {
  it('ordena chaves recursivamente, omite undefined e não usa espaços', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(canonicalJson({ a: undefined, b: [3, { z: 1, y: 2 }] })).toBe('{"b":[3,{"y":2,"z":1}]}');
  });
});

describe('buildSnapshot', () => {
  it('monta o orçamento: pacote somado, extras rotulados e desconto', () => {
    const s = buildSnapshot(sampleSnapshotInput());
    expect(s.format).toBe(2);
    expect(s.budget.package).toEqual({
      name: 'PACOTE GLAM',
      description: 'Maquiagem e penteado da noiva',
      cents: 310000,
    });
    expect(s.budget.extras).toEqual([
      { label: 'Serviço Adicional: Maquiagem – Mãe', cents: 25000 },
      { label: 'Serviço Adicional: Penteado – Madrinha (teste)', cents: 15000 },
    ]);
    expect(s.budget.discount).toEqual({ label: '10% OFF', cents: 10000 });
    expect(s.budget.totalCents).toBe(340000);
  });

  it('sem pacote todos os itens viram extras e inclui a quantidade > 1', () => {
    const s = buildSnapshot(
      sampleSnapshotInput({
        items: [
          { serviceName: 'Penteado', personLabel: 'Dama', purpose: 'event', quantity: 3, totalCents: 30000, isPackageItem: true, sortOrder: 1 },
        ],
        package: null,
        discount: { cents: 0, description: null },
        totalCents: 30000,
      }),
    );
    expect(s.budget.package).toBeNull();
    expect(s.budget.discount).toBeNull();
    expect(s.budget.extras[0].label).toBe('Serviço Adicional: Penteado × 3 – Dama');
  });

  it('desconto sem descrição usa "Desconto"', () => {
    const s = buildSnapshot(sampleSnapshotInput({ discount: { cents: 10000, description: '  ' } }));
    expect(s.budget.discount?.label).toBe('Desconto');
  });

  it('pacote com soma zero continua existindo', () => {
    const s = buildSnapshot(
      sampleSnapshotInput({
        items: [
          { serviceName: 'Maquiagem', personLabel: 'Mãe', purpose: 'event', quantity: 1, totalCents: 10000, isPackageItem: false, sortOrder: 1 },
        ],
        discount: { cents: 0, description: null },
        totalCents: 10000,
      }),
    );
    expect(s.budget.package?.cents).toBe(0);
  });

  it('recusa total divergente', () => {
    expect(() => buildSnapshot(sampleSnapshotInput({ totalCents: 1 }))).toThrow(
      new RangeError('SNAPSHOT_TOTAL_MISMATCH'),
    );
  });

  it('normaliza contratante, evento e pagamento', () => {
    const s = buildSnapshot(
      sampleSnapshotInput({
        contractor: {
          name: null, cpf: '12345678909', rg: null, address: null, postalCode: null,
          email: null, phone1: null, phone2: null, phone3: null,
        },
        event: { date: '2027-03-20', time: null, locationName: null, serviceAddress: null },
        payment: {
          mode: 'sinal_parcelado',
          installments: [
            { seq: 2, dueDate: '2026-12-10', cents: 20000 },
            { seq: 1, dueDate: '2026-11-10', cents: 20000 },
          ],
          balanceDueDaysBefore: 10,
        },
      }),
    );
    expect(s.contractor.name).toBe('');
    expect(s.contractor.cpf).toBe('123.456.789-09');
    expect(s.event).toEqual({ date: '2027-03-20', time: '', locationName: '', serviceAddress: '' });
    expect(s.payment.installments.map((i) => i.seq)).toEqual([1, 2]);
    expect(s.payment.balanceDueDaysBefore).toBe(10);
  });

  it('à vista não tem prazo de saldo', () => {
    const s = buildSnapshot(
      sampleSnapshotInput({
        payment: { mode: 'a_vista', installments: [{ seq: 1, dueDate: '2026-11-10', cents: 340000 }], balanceDueDaysBefore: 10 },
      }),
    );
    expect(s.payment.balanceDueDaysBefore).toBeNull();
  });
});

describe('snapshotHash', () => {
  const base = () => buildSnapshot(sampleSnapshotInput());

  it('é determinístico, inclusive com chaves em outra ordem', () => {
    const a = base();
    expect(snapshotHash(a)).toBe(snapshotHash(base()));
    expect(snapshotHash(a)).toMatch(/^[0-9a-f]{64}$/);
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as ContractSnapshot;
    expect(snapshotHash(reordered)).toBe(snapshotHash(a));
  });

  const mutations: [string, (s: ContractSnapshot) => void][] = [
    ['contractor.rg', (s) => { s.contractor.rg = '999'; }],
    ['event.time', (s) => { s.event.time = '15:00'; }],
    ['extra cents', (s) => { s.budget.extras[0].cents += 1; }],
    ['discount label', (s) => { s.budget.discount!.label = 'Outro'; }],
    ['payment dueDate', (s) => { s.payment.installments[0].dueDate = '2026-11-11'; }],
    ['texts.clauses', (s) => { s.texts.clauses += ' '; }],
    ['studio.cnpj', (s) => { s.studio.cnpj = '00.000.000/0001-00'; }],
    ['letterhead.sha256', (s) => { s.letterhead = { sha256: 'b'.repeat(64), mimeType: 'image/png' }; }],
    ['kind', (s) => { s.kind = 'debutante'; }],
    ['debutanteName', (s) => { s.debutanteName = 'Ana'; }],
    ['package.name', (s) => { s.budget.package!.name = 'X'; }],
    ['code', (s) => { s.code = 'CT-2026-0002'; }],
  ];
  it.each(mutations)('muda ao alterar %s', (_n, mutate) => {
    const s = base();
    const before = snapshotHash(s);
    mutate(s);
    expect(snapshotHash(s)).not.toBe(before);
  });
});

describe('snapshotToPlainText', () => {
  it('traz título, partes, orçamento, parcelas e cláusulas sem **', () => {
    const t = snapshotToPlainText(buildSnapshot(sampleSnapshotInput()));
    expect(t).toContain('CONTRATO DE PRESTAÇÃO DE SERVIÇOS');
    expect(t).toContain('Contratante: Maria Souza');
    expect(t).toContain('Pacote contratado: PACOTE GLAM');
    expect(t).toContain('Serviço Adicional: Maquiagem – Mãe');
    expect(t).toContain('Serviço Adicional: Penteado – Madrinha (teste)');
    expect(t).toMatch(/Total: R\$\s3\.400,00/);
    expect(t).toMatch(/SINAL 1\/2 · 10\/11\/2026 · R\$\s200,00/);
    expect(t).toMatch(/SINAL 2\/2 · 10\/12\/2026 · R\$\s200,00/);
    expect(t).toContain('CLÁUSULA 1ª');
    expect(t).not.toContain('**');
  });

  it('rotula SINAL único e À VISTA', () => {
    const one = snapshotToPlainText(
      buildSnapshot(sampleSnapshotInput({ payment: { mode: 'sinal', installments: [{ seq: 1, dueDate: '2026-11-10', cents: 40000 }], balanceDueDaysBefore: 10 } })),
    );
    expect(one).toMatch(/SINAL · 10\/11\/2026/);
    const av = snapshotToPlainText(
      buildSnapshot(sampleSnapshotInput({ payment: { mode: 'a_vista', installments: [{ seq: 1, dueDate: '2026-11-10', cents: 340000 }], balanceDueDaysBefore: 10 } })),
    );
    expect(av).toMatch(/À VISTA · 10\/11\/2026/);
  });
});

describe('teste incluso no pacote (261108-n2o)', () => {
  const comTesteIncluso = () =>
    sampleSnapshotInput({
      items: [
        { serviceName: 'Maquiagem noiva', personLabel: 'Noiva', purpose: 'event', quantity: 1, totalCents: 75000, isPackageItem: true, sortOrder: 1 },
        { serviceName: 'Maquiagem noiva', personLabel: 'Noiva', purpose: 'trial', quantity: 1, totalCents: 75000, isPackageItem: true, sortOrder: 2, settledAtEvent: true },
        { serviceName: 'Penteado noiva', personLabel: 'Noiva', purpose: 'event', quantity: 1, totalCents: 50000, isPackageItem: true, sortOrder: 3 },
        { serviceName: 'Penteado noiva', personLabel: 'Noiva', purpose: 'trial', quantity: 1, totalCents: 50000, isPackageItem: true, sortOrder: 4, settledAtEvent: true },
        { serviceName: 'Maquiagem', personLabel: 'Noiva', purpose: 'trial', quantity: 1, totalCents: 60000, isPackageItem: true, sortOrder: 5 },
        { serviceName: 'Maquiagem', personLabel: 'Mãe', purpose: 'event', quantity: 1, totalCents: 25000, isPackageItem: false, sortOrder: 6 },
        { serviceName: 'Penteado', personLabel: 'Madrinha', purpose: 'trial', quantity: 1, totalCents: 15000, isPackageItem: false, sortOrder: 7 },
      ],
    });

  it('lista os testes inclusos (sem repetir, na ordem) e mantém o total do pacote', () => {
    const s = buildSnapshot(comTesteIncluso());
    expect(s.budget.package).toEqual({
      name: 'PACOTE GLAM',
      description: 'Maquiagem e penteado da noiva',
      cents: 310000,
      includedTrials: ['Maquiagem noiva', 'Penteado noiva'],
    });
    expect(s.budget.totalCents).toBe(340000);
  });

  it('sem teste incluso a chave não existe (snapshot e hash antigos iguais)', () => {
    const antigo = buildSnapshot(sampleSnapshotInput());
    expect(antigo.budget.package).not.toHaveProperty('includedTrials');
    const comFlagFalsa = buildSnapshot(
      sampleSnapshotInput({
        items: sampleSnapshotInput().items.map((i) => ({ ...i, settledAtEvent: false })),
      }),
    );
    expect(snapshotHash(comFlagFalsa)).toBe(snapshotHash(antigo));
  });

  it('teste incluso de item fora do pacote não entra na lista', () => {
    const input = comTesteIncluso();
    input.items = input.items.map((i) =>
      i.serviceName === 'Penteado' ? { ...i, settledAtEvent: true } : i,
    );
    expect(buildSnapshot(input).budget.package?.includedTrials).toEqual([
      'Maquiagem noiva',
      'Penteado noiva',
    ]);
  });

  it('texto mostra o teste como incluso, pago no evento', () => {
    const txt = snapshotToPlainText(buildSnapshot(comTesteIncluso()));
    expect(txt).toContain(
      'Inclui: Maquiagem noiva (teste — incluso, pago no evento); Penteado noiva (teste — incluso, pago no evento)',
    );
    expect(snapshotToPlainText(buildSnapshot(sampleSnapshotInput()))).not.toContain('Inclui:');
  });
});
