import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import {
  CancelAppointmentMutation,
  type AppointmentData,
} from "../api/appointments.api";
import { CancelAppointmentDialog } from "../components/calendar/CancelAppointmentDialog";

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

function setup(reasonTag: string | null, reason: string) {
  const result = vi.fn(() => ({
    data: { cancelAppointment: { appointment: null, errors: [] } },
  }));
  const onCancelled = vi.fn();
  render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: CancelAppointmentMutation,
            variables: { input: { id: "a1", reason, reasonTag } },
          },
          result,
        },
      ]}
    >
      <CancelAppointmentDialog
        appointment={appointment}
        open
        onOpenChange={vi.fn()}
        onCancelled={onCancelled}
      />
    </MockedProvider>,
  );
  return { result, onCancelled };
}

describe("CancelAppointmentDialog", () => {
  it("exige motivo com ao menos 3 caracteres", () => {
    setup(null, "Cliente viajou");
    const submit = screen.getByTestId("cancel-submit");
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId("cancel-reason"), { target: { value: "ab" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId("cancel-reason"), {
      target: { value: "Cliente viajou" },
    });
    expect(submit).toBeEnabled();
  });

  it("avisa que o sinal continua como crédito", () => {
    setup(null, "x");
    expect(screen.getByText(/sinal de R\$ 50,00 continua como crédito/)).toBeInTheDocument();
  });

  it("tag no-show preenche o motivo e envia reasonTag", async () => {
    const { result, onCancelled } = setup("no_show", "Cliente não compareceu");
    fireEvent.click(screen.getByTestId("cancel-reason-tag-no_show"));
    expect(screen.getByTestId("cancel-reason")).toHaveValue("Cliente não compareceu");
    fireEvent.click(screen.getByTestId("cancel-submit"));
    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(result).toHaveBeenCalled();
  });
});
