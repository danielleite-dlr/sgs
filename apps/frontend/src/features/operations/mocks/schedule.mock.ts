// Mock data for SchedulePage — Phase 3 mockup
// No real backend integration — static data only

export interface MockProfessional {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface MockAppointment {
  id: string;
  professionalId: string;
  clientName: string;
  service: string;
  categoryColor: string;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed';
  dayOfWeek: number; // 0 = Monday, 4 = Friday
}

export const MOCK_PROFESSIONALS: MockProfessional[] = [
  { id: 'p1', name: 'Ana Souza', initials: 'AS', color: '#5D54C7' },
  { id: 'p2', name: 'Bruno Lima', initials: 'BL', color: '#1D9E75' },
  { id: 'p3', name: 'Carla Reis', initials: 'CR', color: '#EF9F27' },
  { id: 'p4', name: 'Diego Melo', initials: 'DM', color: '#D85A30' },
  { id: 'p5', name: 'Elena Costa', initials: 'EC', color: '#3C3489' },
];

// Category colors
const CAT_COLORS = {
  hair: '#5D54C7',
  esthetic: '#1D9E75',
  nails: '#EF9F27',
  bridal: '#D85A30',
  massage: '#888780',
};

export const MOCK_APPOINTMENTS: MockAppointment[] = [
  // Monday (day 0)
  { id: 'a1',  professionalId: 'p1', clientName: 'Maria Silva',   service: 'Corte + Escova',        categoryColor: CAT_COLORS.hair,     startHour: 9,  startMinute: 0,  durationMinutes: 90, status: 'confirmed',    dayOfWeek: 0 },
  { id: 'a2',  professionalId: 'p2', clientName: 'João Santos',   service: 'Hidratação',             categoryColor: CAT_COLORS.hair,     startHour: 10, startMinute: 0,  durationMinutes: 60, status: 'scheduled',    dayOfWeek: 0 },
  { id: 'a3',  professionalId: 'p3', clientName: 'Lucia Ferreira',service: 'Unhas Gel',             categoryColor: CAT_COLORS.nails,    startHour: 9,  startMinute: 30, durationMinutes: 120, status: 'in_progress', dayOfWeek: 0 },
  { id: 'a4',  professionalId: 'p4', clientName: 'Paula Alves',   service: 'Limpeza de Pele',       categoryColor: CAT_COLORS.esthetic, startHour: 11, startMinute: 0,  durationMinutes: 60, status: 'scheduled',    dayOfWeek: 0 },

  // Tuesday (day 1)
  { id: 'a5',  professionalId: 'p1', clientName: 'Fernanda Costa',service: 'Coloração',             categoryColor: CAT_COLORS.hair,     startHour: 8,  startMinute: 0,  durationMinutes: 180, status: 'confirmed',   dayOfWeek: 1 },
  { id: 'a6',  professionalId: 'p5', clientName: 'Ana Bridal',    service: 'Penteado Noiva',        categoryColor: CAT_COLORS.bridal,   startHour: 14, startMinute: 0,  durationMinutes: 120, status: 'confirmed',   dayOfWeek: 1 },
  { id: 'a7',  professionalId: 'p3', clientName: 'Sandra Lima',   service: 'Manicure',              categoryColor: CAT_COLORS.nails,    startHour: 13, startMinute: 0,  durationMinutes: 60, status: 'scheduled',    dayOfWeek: 1 },

  // Wednesday (day 2)
  { id: 'a8',  professionalId: 'p2', clientName: 'Roberto Melo',  service: 'Barba',                 categoryColor: CAT_COLORS.hair,     startHour: 9,  startMinute: 0,  durationMinutes: 45, status: 'confirmed',    dayOfWeek: 2 },
  { id: 'a9',  professionalId: 'p4', clientName: 'Vivian Torres', service: 'Massagem Relaxante',    categoryColor: CAT_COLORS.massage,  startHour: 10, startMinute: 30, durationMinutes: 60, status: 'scheduled',    dayOfWeek: 2 },
  { id: 'a10', professionalId: 'p1', clientName: 'Camila Pereira',service: 'Escova Progressiva',    categoryColor: CAT_COLORS.hair,     startHour: 14, startMinute: 0,  durationMinutes: 150, status: 'scheduled',   dayOfWeek: 2 },

  // Thursday (day 3)
  { id: 'a11', professionalId: 'p5', clientName: 'Isabela Rocha', service: 'Make Noiva',            categoryColor: CAT_COLORS.bridal,   startHour: 8,  startMinute: 0,  durationMinutes: 120, status: 'confirmed',   dayOfWeek: 3 },
  { id: 'a12', professionalId: 'p3', clientName: 'Mariana Dias',  service: 'Pedicure + Spa',        categoryColor: CAT_COLORS.nails,    startHour: 11, startMinute: 0,  durationMinutes: 90, status: 'scheduled',    dayOfWeek: 3 },
];

export const STATUS_LABELS: Record<MockAppointment['status'], string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

export const STATUS_COLORS: Record<MockAppointment['status'], string> = {
  scheduled: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  confirmed: 'bg-primary-50 text-primary-700 border-primary-200',
  in_progress: 'bg-success-50 text-success-700 border-success-200',
  completed: 'bg-neutral-50 text-neutral-500 border-neutral-200',
};

// Week days for the current week (starting Monday)
export function getMockWeekDays(): Date[] {
  const today = new Date(2026, 4, 4); // Mock: Monday May 4, 2026
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

export const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = i % 2 === 0 ? 0 : 30;
  return { hour, minute, label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
});
