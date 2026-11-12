import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MembersQuery } from '@/features/catalog/api/members.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  AppointmentsQuery,
  TimeBlocksQuery,
  type AppointmentData,
  type TimeBlockData,
} from '../api/appointments.api';
import { AppointmentCard } from '../components/calendar/AppointmentCard';
import { DayGrid, type DayGridProps } from '../components/calendar/DayGrid';
import { TimeBlockOverlay } from '../components/calendar/TimeBlockOverlay';
import { WeekGrid } from '../components/calendar/WeekGrid';
import {
  getAppointmentStyle,
  type ScheduleAppointment,
} from '../components/calendar/types';
import { STATUS_SPINE_COLORS, statusSpineColor } from '../lib/appointment-status-style';
import { PROFESSIONAL_TONES } from '../lib/professional-colors';
import { SchedulePage } from '../pages/SchedulePage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Fase 6, lote 06-03: Agenda do dia no layout Gestor Beauty (D-11, D-19, D-25).

const appt = (over: Partial<ScheduleAppointment> = {}): ScheduleAppointment => ({
  id: 'a1',
  professionalId: 'p1',
  clientName: 'maria silva',
  service: 'Penteado',
  categoryColor: '#109868',
  start: new Date(2026, 10, 12, 9, 0),
  end: new Date(2026, 10, 12, 10, 30),
  durationMinutes: 90,
  status: 'confirmed',
  ...over,
});

function renderCard(a: ScheduleAppointment) {
  return render(
    <TooltipProvider>
      <AppointmentCard appointment={a} style={getAppointmentStyle(a, 48)} draggable={false} />
    </TooltipProvider>,
  );
}

describe('cor de status (D-11)', () => {
  it('statusSpineColor devolve a cor de cada status e um cinza para o desconhecido', () => {
    expect(statusSpineColor('scheduled')).toBe('#570080');
    expect(statusSpineColor('confirmed')).toBe('#109868');
    expect(statusSpineColor('in_progress')).toBe('#0E61A8');
    expect(statusSpineColor('completed')).toBe('#49454F');
    expect(statusSpineColor('no_show')).toBe('#C53030');
    expect(statusSpineColor('cancelled')).toBe('#C53030');
    expect(statusSpineColor('qualquer')).toBe('#6B7280');
    expect(Object.keys(STATUS_SPINE_COLORS)).toHaveLength(6);
  });

  it('getAppointmentStyle: sem tom fica branco, borda do status, posição igual à de antes', () => {
    const style = getAppointmentStyle(appt({ status: 'in_progress' }), 48);
    // quick-261108-n4s: o fundo vai por variável CSS (o hover da classe continua valendo).
    expect(style['--appt-bg']).toBe('#FFFFFF');
    expect(style['--appt-bg-hover']).toBe('#F9FAFB');
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderLeft).toBe('3px solid #0E61A8');
    // 09:00 = 4 slots depois das 07:00; 90 min = 3 slots (- 4 px de respiro).
    expect(style.top).toBe('192px');
    expect(style.height).toBe('140px');
  });

  it('getAppointmentStyle: com tom da profissional, fundo dela e borda do status', () => {
    const style = getAppointmentStyle(appt({ status: 'in_progress' }), 48, PROFESSIONAL_TONES[1]);
    expect(style['--appt-bg']).toBe('#DCFCE7');
    expect(style['--appt-bg-hover']).toBe(PROFESSIONAL_TONES[1].bgHover);
    expect(style.borderLeft).toBe('3px solid #0E61A8');
  });
});

describe('bloco de agendamento (D-11, D-19)', () => {
  it('nome em serifa com toDisplayName, serviço e horário tabular', () => {
    renderCard(appt());
    const card = screen.getByTestId('appointment-card-a1');
    expect(card.className).toContain('bg-[var(--appt-bg,#FFFFFF)]');
    expect(card.className).toContain('hover:bg-[var(--appt-bg-hover,#F9FAFB)]');
    expect(card.className).toMatch(/\bborder-neutral-200\b/);
    expect(card.className).toMatch(/\brounded-md\b/);
    expect(card.className).not.toMatch(/shadow/);
    expect(card).toHaveAttribute('aria-label', 'maria silva, Penteado, 09:00 a 10:30');
    const nome = within(card).getByText('Maria Silva');
    expect(nome.className).toMatch(/\bfont-serif\b/);
    expect(within(card).getByText('Penteado').className).toMatch(/\btext-neutral-600\b/);
    const hora = screen.getByTestId('appointment-time-a1');
    expect(hora).toHaveTextContent('09:00 - 10:30 • 90 min');
    expect(hora.className).toMatch(/\btabular-nums\b/);
    expect(hora.className).toMatch(/\btext-neutral-600\b/);
  });

  it('com 60 min ou mais mostra o selo de status com ponto de 6 px', () => {
    renderCard(appt());
    const selo = screen.getByTestId('appointment-status-a1');
    expect(selo).toHaveTextContent('Confirmado');
    expect(selo.className).toMatch(/\brounded-md\b/);
    const ponto = selo.querySelector('span');
    expect(ponto?.className).toMatch(/\bh-1\.5\b/);
    expect(ponto?.className).toMatch(/\brounded-full\b/);
  });

  it('nome sozinho na 1ª linha, serviço pequeno logo abaixo e selo depois do horário (visão Dia estreita)', () => {
    renderCard(appt());
    const card = screen.getByTestId('appointment-card-a1');
    const nome = screen.getByTestId('appointment-name-a1');
    const selo = screen.getByTestId('appointment-status-a1');
    expect(nome).toHaveTextContent('Maria Silva');
    expect(nome.className).toMatch(/\btruncate\b/);
    // o selo não divide a linha com o nome
    expect(nome.parentElement).toBe(card);
    const servico = within(card).getByText('Penteado');
    expect(servico.className).toMatch(/text-\[12px\]/);
    expect(servico.className).toMatch(/\btruncate\b/);
    const hora = screen.getByTestId('appointment-time-a1');
    // ordem no DOM: nome → serviço → horário → selo
    const segue = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(segue(nome, servico)).toBe(true);
    expect(nome.nextElementSibling).toBe(servico);
    expect(segue(servico, hora)).toBe(true);
    expect(segue(hora, selo)).toBe(true);
    expect(nome.contains(selo)).toBe(false);
    expect(selo.parentElement).not.toBe(nome.parentElement);
  });

  it('com menos de 60 min não mostra o selo', () => {
    renderCard(appt({ durationMinutes: 30, end: new Date(2026, 10, 12, 9, 30) }));
    expect(screen.queryByTestId('appointment-status-a1')).toBeNull();
  });
});

const block = (kind: TimeBlockData['kind']): TimeBlockData => ({
  id: `b-${kind}`,
  kind,
  professionalId: 'p1',
  startsAt: new Date(2026, 10, 12, 12, 0).toISOString(),
  endsAt: new Date(2026, 10, 12, 13, 0).toISOString(),
  allDay: false,
  note: null,
});

describe('bloqueio em hachura (D-19)', () => {
  it.each([
    ['feriado', 'border-error-500'],
    ['intervalo', 'border-warning-500'],
    ['folga', 'border-neutral-500'],
    ['indisponibilidade', 'border-info-500'],
  ] as const)('%s: hachura neutra com borda %s', (kind, borda) => {
    render(<TimeBlockOverlay block={block(kind)} slotHeight={48} />);
    const el = screen.getByTestId(`time-block-b-${kind}`);
    expect(el.style.backgroundImage).toContain('repeating-linear-gradient(135deg');
    expect(el.className).toMatch(/border-l-\[3px\]/);
    expect(el.className).toContain(borda);
    expect(el.className).not.toMatch(/slate|amber|rose|sky/);
  });
});

const at = (d: Date, h: number, m = 0) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();

const appointmentData = (id: string, day: Date, h: number, pro = 'p1'): AppointmentData => ({
  id,
  professionalId: pro,
  clientId: `c-${id}`,
  serviceId: 's1',
  serviceVariantId: null,
  comandaId: null,
  comandaCode: null,
  comandaStatus: null,
  depositAmount: '0.00',
  startsAt: at(day, h),
  endsAt: at(day, h + 1),
  status: 'scheduled',
  notes: null,
  cancelReason: null,
  cancelReasonTag: null,
  cancelledAt: null,
  client: { id: `c-${id}`, fullName: 'Ana Paula' },
  professional: { id: pro, displayName: 'Bia Souza' },
  service: { id: 's1', name: 'Corte' },
});

const professionals = [
  { id: 'p1', name: 'BIA SOUZA', initials: 'BS', color: '#570080' },
  { id: 'p2', name: 'Carla Lima', initials: 'CL', color: '#0B7A53' },
  { id: 'p3', name: 'Dora Reis', initials: 'DR', color: '#0E61A8' },
];

function renderGrid(date: Date, over: Partial<DayGridProps> = {}) {
  const props: DayGridProps = {
    date,
    professionals,
    appointments: [
      appointmentData('a1', date, 9),
      appointmentData('a2', date, 14),
      appointmentData('a3', date, 10, 'p2'),
    ],
    timeBlocks: [],
    slotHeight: 48,
    colWidth: 'minmax(160px,1fr)',
    canSchedule: true,
    canDrag: true,
    showFolga: true,
    onSlotClick: vi.fn(),
    ...over,
  };
  return render(
    <MockedProvider mocks={[]}>
      <DayGrid {...props} />
    </MockedProvider>,
  );
}

describe('grade do dia (D-19)', () => {
  afterEach(() => vi.useRealTimers());

  it('cabeçalho da coluna com nome em serifa e contagem de atendimentos', () => {
    renderGrid(new Date(2026, 10, 4));
    const nome = screen.getByText('Bia Souza');
    expect(nome.className).toMatch(/\bfont-serif\b/);
    expect(nome.className).not.toMatch(/uppercase/);
    expect(screen.getByTestId('lane-count-p1')).toHaveTextContent('2 atendimentos');
    expect(screen.getByTestId('lane-count-p2')).toHaveTextContent('1 atendimento');
    expect(screen.getByTestId('lane-count-p2')).not.toHaveTextContent('atendimentos');
    expect(screen.getByTestId('lane-count-p3')).toHaveTextContent('0 atendimentos');
  });

  it('horas na margem como 07:00, linha cheia na hora e tracejada na meia hora', () => {
    renderGrid(new Date(2026, 10, 4));
    const rows = screen.getAllByTestId('time-row');
    expect(rows[0]).toHaveTextContent('07:00');
    expect(rows[1].textContent).toBe('');
    expect(screen.getByTestId('slot-p1-09:00').className).not.toMatch(/border-dashed/);
    expect(screen.getByTestId('slot-p1-09:30').className).toMatch(/border-dashed/);
  });

  it('faixa fora do expediente em papel neutro, sem o azul antigo', () => {
    const { container } = renderGrid(new Date(2026, 10, 4));
    expect(container.innerHTML).not.toMatch(/#DDE7F3|221, 231, 243/i);
  });

  it('hora atual em roxo com o horário escrito', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 10, 45));
    renderGrid(new Date(2026, 10, 12));
    const linha = screen.getByTestId('now-line');
    expect(linha.innerHTML).toMatch(/\bbg-primary\b/);
    expect(linha.innerHTML).not.toMatch(/bg-error/);
    const selo = within(linha).getByText('10:45');
    expect(selo.className).toMatch(/\btabular-nums\b/);
  });
});

describe('semana (D-11)', () => {
  it('card da semana com borda do status e nome em serifa', () => {
    const day = new Date(2026, 10, 4);
    render(
      <WeekGrid
        days={[day]}
        appointments={[appointmentData('a1', day, 9)]}
        timeBlocks={[]}
        onOpenDay={vi.fn()}
      />,
    );
    const card = screen.getByTestId('week-card-a1');
    expect(card.style.borderLeft).toContain('3px solid');
    expect(card.className).toContain('bg-[var(--appt-bg,#FFFFFF)]');
    expect(card.className).toContain('hover:bg-[var(--appt-bg-hover,#F9FAFB)]');
    expect(within(card).getByText('Ana Paula').className).toMatch(/\bfont-serif\b/);
  });
});

function renderSchedule() {
  useAuthStore.setState({ roleName: 'ADMIN', memberId: 'x' });
  const members = [
    {
      id: 'p1',
      displayName: 'Bia Souza',
      email: 'p1@x.com',
      roleName: 'PROFESSIONAL',
      seniorityTier: null,
      isProfessional: true,
    },
  ];
  const mocks: MockedResponse[] = [
    { request: { query: MembersQuery }, result: { data: { members } }, maxUsageCount: 10 },
    {
      request: { query: AppointmentsQuery },
      variableMatcher: () => true,
      result: { data: { appointments: [] } },
      maxUsageCount: 10,
    },
    {
      request: { query: TimeBlocksQuery },
      variableMatcher: () => true,
      result: { data: { timeBlocks: [] } },
      maxUsageCount: 10,
    },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <SchedulePage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('barra da agenda (D-06, D-19, D-25)', () => {
  it('"Agendar" é a ação principal roxa com texto branco', async () => {
    renderSchedule();
    const agendar = await screen.findByRole('button', { name: 'Agendar' });
    expect(agendar.className).toMatch(/\bbg-primary\b/);
    expect(agendar.className).toMatch(/\btext-white\b/);
    expect(agendar.className).not.toMatch(/bg-error/);
  });

  it('sem botões de profissionais na barra; "Filtros" com texto (quick 261112-e7v)', async () => {
    renderSchedule();
    await screen.findAllByRole('button', { name: 'Bia Souza — visível' });
    expect(screen.queryByTestId('prof-avatars')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Agenda de Bia Souza' })).toBeNull();
    expect(screen.getByTestId('filters-open')).toHaveTextContent('Filtros');
  });

  it('filtro lateral: uma linha por profissional com bolinha e nome completo', async () => {
    renderSchedule();
    const [linha] = await screen.findAllByRole('button', { name: 'Bia Souza — visível' });
    expect(within(linha).getByText('Bia Souza', { exact: true })).toBeInTheDocument();
    expect(within(linha).getByText('BS', { exact: true })).toBeInTheDocument();
    expect(linha).toHaveAttribute('aria-pressed', 'true');
    expect(linha.className).toMatch(/min-h-\[44px\]/);
    fireEvent.click(linha);
    expect(linha).toHaveAttribute('aria-label', 'Bia Souza — oculto');
    expect(linha).toHaveAttribute('aria-pressed', 'false');
  });

  it('sem o rodapé institucional (D-25) e sem textos do design que o SGS não tem (D-02)', async () => {
    const { container } = renderSchedule();
    await waitFor(() => expect(screen.getByTestId('view-day')).toBeInTheDocument());
    expect(screen.queryByRole('navigation', { name: 'Links institucionais' })).toBeNull();
    expect(screen.queryByText('Fale conosco')).toBeNull();
    expect(container.textContent).not.toMatch(/Cadeira|bancada|Horário livre|Sincronizado/i);
  });

  it('status do filtro em selos de 6 px com ponto, sem pílula colorida', async () => {
    renderSchedule();
    await waitFor(() => expect(screen.getByTestId('view-day')).toBeInTheDocument());
    const status = screen.getAllByRole('button', { name: 'Confirmado' })[0];
    expect(status.className).toMatch(/\brounded-md\b/);
    expect(status.className).not.toMatch(/rounded-full/);
    expect(status.getAttribute('style') ?? '').not.toMatch(/background/);
    const ponto = status.querySelector('span');
    expect(ponto?.className).toMatch(/\brounded-full\b/);
    expect(ponto?.className).toMatch(/\bh-1\.5\b/);
  });
});

describe('contrato de seletores (E2E usa [data-testid^="appointment-card-"])', () => {
  it('só o próprio card tem data-testid começando com appointment-card-', () => {
    const { container } = renderCard(appt());
    expect(container.querySelectorAll('[data-testid^="appointment-card-"]')).toHaveLength(1);
  });
});
