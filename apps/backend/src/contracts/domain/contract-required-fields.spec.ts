import {
  formatMissingMessage,
  missingRequiredFields,
  type ReadinessInput,
} from './contract-required-fields';

const ok = (o: Partial<ReadinessInput> = {}): ReadinessInput => ({
  kind: 'noiva',
  groupId: 'g1',
  contractId: 'c1',
  contractor: {
    clientId: 'cl1',
    fullName: 'Maria Souza',
    cpf: '123.456.789-09',
    address: 'Rua A, 10',
    phone: '(19) 99999-0001',
    phone2: '(19) 99999-0002',
  },
  eventDate: '2027-03-20',
  eventTime: '14:00',
  hasPackage: true,
  paymentMode: 'sinal',
  depositCents: 20000,
  studio: {
    name: 'Studio JS',
    cnpj: '12.345.678/0001-90',
    representative: 'Josi',
    address: 'Rua X',
    forumCity: 'São Paulo',
    forumUf: 'SP',
  },
  ...o,
});
const codes = (i: ReadinessInput) => missingRequiredFields(i).map((m) => m.code);

describe('missingRequiredFields', () => {
  it('completo: sem pendências', () => {
    expect(missingRequiredFields(ok())).toEqual([]);
  });
  it('contratante incompleta, na ordem e com alvo', () => {
    const m = missingRequiredFields(
      ok({ contractor: { clientId: 'cl1', fullName: ' ', cpf: '111.111.111-11', address: null, phone: '', phone2: null } }),
    );
    expect(m.map((x) => x.code)).toEqual([
      'CONTRACTOR_NAME', 'CONTRACTOR_CPF', 'CONTRACTOR_ADDRESS', 'CONTRACTOR_PHONE1', 'CONTRACTOR_PHONE2',
    ]);
    expect(m[0]).toEqual({ code: 'CONTRACTOR_NAME', label: 'Nome da contratante', target: 'client', targetId: 'cl1' });
    expect(m[1].label).toBe('CPF da contratante');
  });
  it('debutante sem responsável não lista itens da contratante', () => {
    const m = missingRequiredFields(ok({ kind: 'debutante', contractor: null, eventTime: null }));
    expect(m.map((x) => x.code)).toEqual(['RESPONSIBLE_MISSING', 'EVENT_TIME']);
    expect(m[0]).toMatchObject({ label: 'Responsável pela debutante', target: 'group', targetId: 'g1' });
  });
  it('evento, pacote e sinal', () => {
    const m = missingRequiredFields(ok({ eventDate: null, eventTime: '', hasPackage: false, depositCents: 0 }));
    expect(m.map((x) => x.code)).toEqual(['EVENT_DATE', 'EVENT_TIME', 'PACKAGE', 'DEPOSIT_ZERO']);
    expect(m[2]).toMatchObject({ target: 'contract', targetId: 'c1' });
    expect(m[3]).toMatchObject({ label: 'Valor do sinal', target: 'contract', targetId: 'c1' });
  });
  it('à vista com valor 0 não gera DEPOSIT_ZERO', () => {
    expect(codes(ok({ paymentMode: 'a_vista', depositCents: 0 }))).toEqual([]);
  });
  it('studio: um único item com a lista do que falta', () => {
    const m = missingRequiredFields(ok({ studio: { ...ok().studio, forumCity: null, forumUf: '  ' } }));
    expect(m).toEqual([
      { code: 'STUDIO_DATA', label: 'Dados do studio: cidade do foro, UF do foro', target: 'settings', targetId: null },
    ]);
  });
  it('studio: ordem nome, CNPJ, endereço, representante', () => {
    const m = missingRequiredFields(
      ok({ studio: { name: '', cnpj: '', representative: '', address: '', forumCity: 'X', forumUf: 'SP' } }),
    );
    expect(m[0].label).toBe('Dados do studio: nome, CNPJ, endereço, representante');
  });
});

describe('formatMissingMessage', () => {
  it('junta os rótulos', () => {
    const m = [
      { code: 'a', label: 'CPF da contratante', target: 'client' as const, targetId: 'x' },
      { code: 'b', label: 'Horário do evento', target: 'group' as const, targetId: 'g' },
    ];
    expect(formatMissingMessage(m)).toBe('Faltam dados para gerar o link: CPF da contratante, Horário do evento.');
  });
});
