import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MockedProvider } from "@apollo/client/testing";
import type { AppointmentData } from "../api/appointments.api";
import { AppointmentDetailsDialog } from "../components/calendar/AppointmentDetailsDialog";

const flag = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/config/features", () => ({ isPathEnabled: () => flag.enabled }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const appointment: AppointmentData = {
  id: "a1",
  professionalId: "p1",
  clientId: "c1",
  serviceId: "s1",
  serviceVariantId: null,
  comandaId: "cm1",
  comandaCode: "C-0001",
  comandaStatus: "open",
  depositAmount: "50.00",
  startsAt: new Date(2026, 10, 4, 10).toISOString(),
  endsAt: new Date(2026, 10, 4, 11).toISOString(),
  status: "scheduled",
  notes: null,
  cancelReason: null,
  cancelReasonTag: null,
  cancelledAt: null,
  client: { id: "c1", fullName: "Ana Paula" },
  professional: { id: "p1", displayName: "Bia" },
  service: { id: "s1", name: "Corte" },
};

function renderDialog(
  canWrite = true,
  agenda: { agendaDate?: Date; agendaView?: "day" | "week" } = {},
) {
  render(
    <MockedProvider mocks={[]}>
      <MemoryRouter>
        <AppointmentDetailsDialog
          appointment={appointment}
          open
          onOpenChange={vi.fn()}
          canWrite={canWrite}
          onChanged={vi.fn()}
          {...agenda}
        />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe("AppointmentDetailsDialog", () => {
  it("com a flag comanda desligada mostra só o código", () => {
    flag.enabled = false;
    renderDialog();
    expect(screen.getByTestId("appointment-comanda-code")).toHaveTextContent("C-0001");
    expect(screen.queryByTestId("appointment-open-comanda")).toBeNull();
    expect(screen.getByTestId("appointment-confirm")).toBeInTheDocument();
    expect(screen.getByTestId("appointment-cancel")).toBeInTheDocument();
  });

  it("com a flag ligada (mock) mostra o link da comanda", () => {
    flag.enabled = true;
    renderDialog();
    expect(screen.getByTestId("appointment-open-comanda")).toHaveAttribute(
      "href",
      "/comanda/cm1?agenda=2026-11-04&visao=day",
    );
    flag.enabled = false;
  });

  it("o link da comanda leva a data e a visão da agenda de origem", () => {
    flag.enabled = true;
    renderDialog(true, { agendaDate: new Date(2026, 10, 6), agendaView: "week" });
    expect(screen.getByTestId("appointment-open-comanda")).toHaveAttribute(
      "href",
      "/comanda/cm1?agenda=2026-11-06&visao=week",
    );
    flag.enabled = false;
  });

  it("sem permissão de escrita não mostra ações", () => {
    flag.enabled = false;
    renderDialog(false);
    expect(screen.queryByTestId("appointment-cancel")).toBeNull();
    expect(screen.queryByTestId("appointment-start")).toBeNull();
  });
});
