import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { WeekGrid } from "../components/calendar/WeekGrid";
import { weekRange } from "../lib/week-range";
import type { AppointmentData, TimeBlockData } from "../api/appointments.api";
import { PROFESSIONAL_TONES } from "../lib/professional-colors";

const days = weekRange(new Date(2026, 10, 4)).days; // quarta 04/11 -> semana 02/11..08/11

const appt: AppointmentData = {
  id: "a1",
  professionalId: "p1",
  clientId: "c1",
  serviceId: "s1",
  serviceVariantId: null,
  comandaId: null,
  comandaCode: null,
  comandaStatus: null,
  depositAmount: "0.00",
  startsAt: new Date(2026, 10, 4, 10, 0).toISOString(),
  endsAt: new Date(2026, 10, 4, 11, 0).toISOString(),
  status: "scheduled",
  notes: null,
  cancelReason: null,
  cancelReasonTag: null,
  cancelledAt: null,
  client: { id: "c1", fullName: "Ana Paula" },
  professional: { id: "p1", displayName: "Bia" },
  service: { id: "s1", name: "Corte" },
};

const holiday: TimeBlockData = {
  id: "h1",
  kind: "feriado",
  professionalId: null,
  startsAt: new Date(2026, 10, 8, 0, 0).toISOString(),
  endsAt: new Date(2026, 10, 9, 0, 0).toISOString(),
  allDay: true,
  note: null,
};

describe("WeekGrid", () => {
  it("mostra 7 colunas começando na segunda", () => {
    render(<WeekGrid days={days} appointments={[]} timeBlocks={[]} onOpenDay={vi.fn()} />);
    const headers = screen.getAllByRole("button", { name: /\d{2}\/\d{2}/ });
    expect(headers).toHaveLength(7);
    expect(headers[0].textContent?.toLowerCase()).toContain("seg");
    expect(screen.getAllByText("Sem agendamentos")).toHaveLength(7);
  });

  it("coloca o agendamento de quarta só na 4ª coluna", () => {
    render(<WeekGrid days={days} appointments={[appt]} timeBlocks={[]} onOpenDay={vi.fn()} />);
    const wed = screen.getByTestId("week-day-2026-11-04");
    // Hora, nome (em serifa) e serviço ficam em trechos separados do mesmo card (fase 6).
    expect(within(wed).getByTestId("week-card-a1")).toHaveTextContent("10:00 · Ana Paula · Corte");
    expect(screen.getAllByText(/Ana Paula/)).toHaveLength(1);
    expect(within(wed).queryByText("Sem agendamentos")).not.toBeInTheDocument();
  });

  it("clicar no cabeçalho de sexta abre o dia", () => {
    const onOpenDay = vi.fn();
    render(<WeekGrid days={days} appointments={[]} timeBlocks={[]} onOpenDay={onOpenDay} />);
    const fri = screen.getByTestId("week-day-2026-11-06");
    fireEvent.click(within(fri).getAllByRole("button")[0]);
    expect(onOpenDay).toHaveBeenCalledTimes(1);
    const arg = onOpenDay.mock.calls[0][0] as Date;
    expect(arg.getDate()).toBe(6);
    expect(arg.getMonth()).toBe(10);
  });

  it("feriado no domingo mostra o selo", () => {
    render(<WeekGrid days={days} appointments={[]} timeBlocks={[holiday]} onOpenDay={vi.fn()} />);
    expect(within(screen.getByTestId("week-day-2026-11-08")).getByText("Feriado")).toBeInTheDocument();
    expect(screen.getAllByText("Feriado")).toHaveLength(1);
  });

  // quick-261108-n4s: mesmo tom da profissional que na vista Dia.
  it("card usa o tom da profissional e mantém a borda do status", () => {
    const tones = new Map([["p1", PROFESSIONAL_TONES[2]]]);
    render(
      <WeekGrid
        days={days}
        appointments={[appt]}
        timeBlocks={[]}
        onOpenDay={vi.fn()}
        toneByProfessional={tones}
      />,
    );
    const card = screen.getByTestId("week-card-a1");
    expect(card.style.getPropertyValue("--appt-bg")).toBe(PROFESSIONAL_TONES[2].bg);
    expect(card.style.getPropertyValue("--appt-bg-hover")).toBe(PROFESSIONAL_TONES[2].bgHover);
    expect(card.style.borderLeft).toContain("3px solid");
    expect(card.className).toContain("bg-[var(--appt-bg,#FFFFFF)]");
  });

  it("sem mapa de tons o card fica branco", () => {
    render(<WeekGrid days={days} appointments={[appt]} timeBlocks={[]} onOpenDay={vi.fn()} />);
    expect(screen.getByTestId("week-card-a1").style.getPropertyValue("--appt-bg")).toBe("#FFFFFF");
  });
});
