import type { SnapshotInput } from '../contract-snapshot';

/** Entrada de exemplo (noiva Studio JS). Total: 3100 + 250 + 150 - 100 = R$ 3.400,00. */
export function sampleSnapshotInput(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    code: 'CT-2026-0001',
    kind: 'noiva',
    generatedOn: '2026-11-04',
    studio: {
      name: 'Studio JS',
      cnpj: '12.345.678/0001-90',
      address: 'Rua das Flores, 100, Centro, São Paulo/SP',
      representative: 'Josi Silva',
      representativeRg: '12.345.678-9',
      forumCity: 'São Paulo',
      forumUf: 'SP',
    },
    letterhead: { sha256: 'a'.repeat(64), mimeType: 'image/png' },
    texts: {
      title: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS',
      intro: 'Pelo presente instrumento particular, as partes abaixo qualificadas.',
      parties: 'CONTRATADA: Studio JS. CONTRATANTE: Maria Souza.',
      trialNote: 'O teste de maquiagem é realizado em data anterior ao evento.',
      clauses:
        '**CLÁUSULA 1ª** O objeto deste contrato é a prestação de serviços de beleza.\n**CLÁUSULA 2ª** O pagamento será conforme o quadro.',
    },
    contractor: {
      name: 'Maria Souza',
      cpf: '12345678909',
      rg: '1234567',
      address: 'Rua A, 10, Centro, Campinas/SP',
      postalCode: '13000-000',
      email: 'maria@example.com',
      phone1: '(19) 99999-0001',
      phone2: '(19) 99999-0002',
      phone3: null,
    },
    debutanteName: null,
    event: {
      date: '2027-03-20',
      time: '14:00',
      locationName: 'Espaço Jardim',
      serviceAddress: 'Av. B, 200, Campinas/SP',
    },
    package: { name: 'PACOTE GLAM', description: 'Maquiagem e penteado da noiva' },
    items: [
      { serviceName: 'Maquiagem', personLabel: 'Noiva', purpose: 'event', quantity: 1, totalCents: 150000, isPackageItem: true, sortOrder: 1 },
      { serviceName: 'Penteado', personLabel: 'Noiva', purpose: 'event', quantity: 1, totalCents: 100000, isPackageItem: true, sortOrder: 2 },
      { serviceName: 'Maquiagem', personLabel: 'Noiva', purpose: 'trial', quantity: 1, totalCents: 60000, isPackageItem: true, sortOrder: 3 },
      { serviceName: 'Maquiagem', personLabel: 'Mãe', purpose: 'event', quantity: 1, totalCents: 25000, isPackageItem: false, sortOrder: 4 },
      { serviceName: 'Penteado', personLabel: 'Madrinha', purpose: 'trial', quantity: 1, totalCents: 15000, isPackageItem: false, sortOrder: 5 },
    ],
    discount: { cents: 10000, description: '10% OFF' },
    totalCents: 340000,
    payment: {
      mode: 'sinal_parcelado',
      installments: [
        { seq: 1, dueDate: '2026-11-10', cents: 20000 },
        { seq: 2, dueDate: '2026-12-10', cents: 20000 },
      ],
      balanceDueDaysBefore: 10,
    },
    ...overrides,
  };
}
