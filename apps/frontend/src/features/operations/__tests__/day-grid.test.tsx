import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { DayGrid, type DayGridProps } from "../components/calendar/DayGrid";
import type {
  AppointmentData,
  TimeBlockData,
} from "../api/appointments.api";
import { NEUTRAL_TONE, PROFESSIONAL_TONES } from "../lib/professional-colors";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const day = new Date(2026, 10, 4);
const at = (h: number, m = 0) => new Date(2026, 10, 4, h, m).toISOString();

const professionals = [
  { id: "p1", name: "Bia Souza", initials: "BS", color: "#5D54C7" },
  { id: "p2", name: "Carla Lima", initials: "CL", color: "#1D9E75" },
];

const appointment: AppointmentData = {
  id: "a1",
  professionalId: "p1",
  clientId: "c1",
  serviceId: "s1",
  serviceVariantId: null,
  comandaId: null,
  comandaCode: null,
  comandaStatus: null,
  depositAmount: "0.00",
  startsAt: at(10),
  endsAt: at(11),
  status: "scheduled",
  notes: null,
  cancelReason: null,
  cancelReasonTag: null,
  cancelledAt: null,
  client: { id: "c1", fullName: "Ana Paula" },
  professional: { id: "p1", displayName: "Bia Souza" },
  service: { id: "s1", name: "Corte" },
};

const block = (
  id: string,
  kind: TimeBlockData["kind"],
  professionalId: string | null,
  from: number,
  to: number,
): TimeBlockData => ({
  id,
  kind,
  professionalId,
  startsAt: at(from),
  endsAt: at(to),
  allDay: false,
  note: null,
});

function renderGrid(over: Partial<DayGridProps> = {}) {
  const props: DayGridProps = {
    date: day,
    professionals,
    appointments: [appointment],
    timeBlocks: [
      block("b1", "intervalo", "p1", 12, 13),
      block("b2", "feriado", null, 20, 21),
    ],
    slotHeight: 48,
    colWidth: "minmax(160px,1fr)",
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

describe("DayGrid", () => {
  it("mostra raias, 30 linhas de horário a partir das 07:00", () => {
    renderGrid();
    expect(screen.getByTestId("lane-p1")).toBeInTheDocument();
    expect(screen.getByTestId("lane-p2")).toBeInTheDocument();
    const rows = screen.getAllByTestId("time-row");
    expect(rows).toHaveLength(30);
    expect(rows[0]).toHaveTextContent("07:00");
    expect(rows[1].textContent).toBe("");
    expect(screen.getByTestId("slot-p1-10:00")).toBeInTheDocument();
    expect(screen.getByTestId("slot-p2-21:30")).toBeInTheDocument();
  });

  it("renderiza o card com contrato de seletores e aria-label", () => {
    renderGrid();
    const card = screen.getByTestId("appointment-card-a1");
    expect(card).toHaveAttribute("data-starts", "10:00");
    expect(card).toHaveAttribute("data-ends", "11:00");
    expect(card).toHaveAttribute("data-professional-id", "p1");
    expect(card.getAttribute("aria-label")).toBe(
      "Ana Paula, Corte, 10:00 a 11:00. Pressione espaço para mover",
    );
  });

  it("mostra intervalo na raia e feriado em todas as raias", () => {
    renderGrid();
    expect(screen.getByLabelText(/Intervalo das 12:00 às 13:00/)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Feriado das 20:00 às 21:00/)).toHaveLength(2);
    const lane1 = screen.getByTestId("lane-p1");
    expect(within(lane1).getByTestId("time-block-b1")).toHaveAttribute("data-kind", "intervalo");
  });

  it("desabilita slots cobertos por bloqueio", () => {
    renderGrid();
    expect(screen.getByTestId("slot-p1-12:00")).toBeDisabled();
    expect(screen.getByTestId("slot-p2-12:00")).toBeEnabled();
    expect(screen.getByTestId("slot-p2-20:30")).toBeDisabled();
  });

  it("showFolga=false esconde bloqueios de folga", () => {
    const folga = block("b3", "folga", "p2", 9, 12);
    const { unmount } = renderGrid({ timeBlocks: [folga], showFolga: true });
    expect(screen.getByTestId("time-block-b3")).toBeInTheDocument();
    unmount();
    renderGrid({ timeBlocks: [folga], showFolga: false });
    expect(screen.queryByTestId("time-block-b3")).not.toBeInTheDocument();
  });

  it("sem permissão de arrastar, o card não anuncia o movimento", () => {
    renderGrid({ canDrag: false });
    const label = screen.getByTestId("appointment-card-a1").getAttribute("aria-label");
    expect(label).toBe("Ana Paula, Corte, 10:00 a 11:00");
    expect(label).not.toContain("Pressione espaço");
  });

  // quick-261108-n4s: fundo do cartão e bolinha na cor da profissional; borda = status.
  it("cartão e bolinha usam o tom de cada profissional", () => {
    const toned = [
      { ...professionals[0], tone: PROFESSIONAL_TONES[0] },
      { ...professionals[1], tone: PROFESSIONAL_TONES[1] },
    ];
    renderGrid({
      professionals: toned,
      appointments: [
        appointment,
        { ...appointment, id: "a2", professionalId: "p2", startsAt: at(14), endsAt: at(15) },
      ],
    });
    const c1 = screen.getByTestId("appointment-card-a1");
    const c2 = screen.getByTestId("appointment-card-a2");
    expect(c1.style.getPropertyValue("--appt-bg")).toBe(PROFESSIONAL_TONES[0].bg);
    expect(c2.style.getPropertyValue("--appt-bg")).toBe(PROFESSIONAL_TONES[1].bg);
    expect(c2.style.borderLeft).toContain("3px solid");
    const avatar = screen.getByTestId("lane-avatar-p2");
    expect(avatar.style.backgroundColor).toBe("rgb(134, 239, 172)"); // #86EFAC
    expect(avatar.className).toMatch(/\btext-neutral-800\b/);
  });

  it("sem tom fica com o visual neutro (cartão branco, bolinha primary-50)", () => {
    renderGrid();
    const card = screen.getByTestId("appointment-card-a1");
    expect(card.style.getPropertyValue("--appt-bg")).toBe(NEUTRAL_TONE.bg);
    expect(screen.getByTestId("lane-avatar-p1").style.backgroundColor).toBe(
      "rgb(245, 230, 251)",
    );
  });

  it("cabeçalho mostra o nome completo, quebrando linha em vez de cortar", () => {
    renderGrid();
    const nome = screen.getByText("Bia Souza", { exact: true });
    expect(nome.className).not.toMatch(/\btruncate\b/);
    expect(nome.className).not.toMatch(/line-clamp/);
    expect(nome.className).toMatch(/\bbreak-words\b/);
  });
});
