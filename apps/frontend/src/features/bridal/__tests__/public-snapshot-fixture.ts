import type { ContractSnapshot } from '../api/public-contract.api';

export const noivaSnapshot: ContractSnapshot = {
  format: 2,
  code: 'CT-2030-001',
  kind: 'noiva',
  generatedOn: '2026-11-04',
  studio: {
    name: 'Studio Jéssica Seixas Beauty',
    cnpj: '48.562.103/0001-71',
    address: 'Rua Álvares de Azevedo, 74 Centro – Osasco',
    representative: 'Jéssica Seixas dos Santos Rodrigues',
    representativeRg: '48.830.035-6',
    forumCity: 'Osasco',
    forumUf: 'SP',
  },
  letterhead: null,
  texts: {
    title: 'Contrato particular de prestação de serviço',
    intro: 'Ao assinar este contrato, a CONTRATANTE declara ter lido.',
    parties:
      '**I. Das partes:** têm entre os mesmos o presente contrato.\n\n**Contratado: Studio JS**, CNPJ 48.562.103/0001-71.',
    trialNote: '**Obs.:** Os testes poderão ser realizados em até 10 dias antes do evento.',
    clauses:
      '**II. Do objeto:**\nO presente contrato tem como OBJETO os serviços.\n\n**III. Das obrigações:**\nA contratada se compromete.',
  },
  contractor: {
    name: 'Maria da Silva',
    cpf: '529.982.247-25',
    rg: '12.345.678-9',
    address: 'Rua das Flores, 10',
    postalCode: '06083-290',
    email: 'maria@example.com',
    phone1: '(11)98888-7777',
    phone2: '(11)97777-6666',
    phone3: '',
  },
  debutanteName: null,
  event: {
    date: '2030-06-15',
    time: '10:00',
    locationName: 'Studio JS Beauty',
    serviceAddress: 'Rua Álvares de Azevedo, 74',
  },
  budget: {
    package: { name: 'PACOTE GLAM', description: '(CONSULTORIA, TESTE)', cents: 310000 },
    extras: [{ label: 'Serviço Adicional: Dia da noiva extra', cents: 20000 }],
    discount: { label: '10% OFF', cents: 10000 },
    totalCents: 320000,
  },
  payment: {
    mode: 'sinal_parcelado',
    installments: [
      { seq: 1, dueDate: '2026-11-10', cents: 20000 },
      { seq: 2, dueDate: '2026-12-10', cents: 20000 },
    ],
    balanceDueDaysBefore: 10,
  },
};

export const debutanteAVistaSnapshot: ContractSnapshot = {
  ...noivaSnapshot,
  kind: 'debutante',
  debutanteName: 'Ana da Silva',
  budget: {
    package: { name: 'OURO ROSA', description: null, cents: 150000 },
    extras: [],
    discount: null,
    totalCents: 150000,
  },
  payment: {
    mode: 'a_vista',
    installments: [{ seq: 1, dueDate: '2026-11-10', cents: 150000 }],
    balanceDueDaysBefore: null,
  },
};
