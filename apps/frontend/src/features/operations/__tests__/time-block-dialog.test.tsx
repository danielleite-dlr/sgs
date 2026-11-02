import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import { CreateTimeBlockMutation } from "../api/appointments.api";
import { TimeBlockDialog } from "../components/calendar/TimeBlockDialog";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const professionals = [
  { id: "p1", name: "Bia Souza", initials: "BS", color: "#5D54C7" },
];
const day = new Date(2026, 10, 4);

function setup(mocks: MockedResponse[] = []) {
  const onCreated = vi.fn();
  render(
    <MockedProvider mocks={mocks}>
      <TimeBlockDialog
        open
        onOpenChange={vi.fn()}
        professionals={professionals}
        defaultDate={day}
        onCreated={onCreated}
      />
    </MockedProvider>,
  );
  return { onCreated };
}

describe("TimeBlockDialog", () => {
  it("feriado esconde o profissional e envia professionalId null", async () => {
    const result = vi.fn(() => ({
      data: { createTimeBlock: { timeBlock: null, errors: [] } },
    }));
    const { onCreated } = setup([
      {
        request: {
          query: CreateTimeBlockMutation,
          variables: {
            input: {
              kind: "feriado",
              professionalId: null,
              startsAt: new Date(2026, 10, 4).toISOString(),
              endsAt: new Date(2026, 10, 5).toISOString(),
              allDay: true,
              note: null,
            },
          },
        },
        result,
      },
    ]);
    expect(screen.getByTestId("block-professional")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("block-kind-feriado"));
    expect(screen.queryByTestId("block-professional")).toBeNull();
    fireEvent.click(screen.getByTestId("block-submit"));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(result).toHaveBeenCalled();
  });

  it("fim antes do início mostra erro", () => {
    setup();
    fireEvent.click(screen.getByTestId("block-kind-intervalo"));
    fireEvent.change(screen.getByTestId("block-professional"), { target: { value: "p1" } });
    fireEvent.change(screen.getByTestId("block-start"), { target: { value: "1400" } });
    fireEvent.change(screen.getByTestId("block-end"), { target: { value: "1300" } });
    fireEvent.click(screen.getByTestId("block-submit"));
    expect(screen.getByTestId("block-error")).toHaveTextContent(
      "O fim deve ser depois do início.",
    );
  });
});
