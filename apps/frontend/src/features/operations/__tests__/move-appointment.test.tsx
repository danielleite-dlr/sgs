import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { gql, InMemoryCache } from "@apollo/client";
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  MoveAppointmentMutation,
  type AppointmentData,
} from "../api/appointments.api";
import { useMoveAppointment } from "../hooks/useMoveAppointment";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const START = new Date(2026, 10, 4, 10, 0);
const NEW_START = new Date(2026, 10, 4, 12, 0);

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
  startsAt: START.toISOString(),
  endsAt: new Date(2026, 10, 4, 11, 0).toISOString(),
  status: "scheduled",
  notes: null,
  cancelReason: null,
  cancelReasonTag: null,
  cancelledAt: null,
  client: { id: "c1", fullName: "Ana" },
  professional: { id: "p1", displayName: "Bia" },
  service: { id: "s1", name: "Corte", defaultDurationMinutes: 60, category: null },
};

const FRAG = gql`
  fragment T on Appointment {
    professionalId
    startsAt
  }
`;

function setup(mocks: MockedResponse[]) {
  const cache = new InMemoryCache();
  cache.writeFragment({
    id: "Appointment:a1",
    fragment: FRAG,
    data: {
      __typename: "Appointment",
      professionalId: "p1",
      startsAt: appointment.startsAt,
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks} cache={cache}>
      {children}
    </MockedProvider>
  );
  const hook = renderHook(() => useMoveAppointment(), { wrapper });
  const read = () =>
    cache.readFragment<{ professionalId: string; startsAt: string }>({
      id: "Appointment:a1",
      fragment: FRAG,
    });
  return { hook, read };
}

const target = {
  professionalId: "p2",
  professionalName: "Carla",
  startsAt: NEW_START,
};

function mockFor(result: MockedResponse["result"], error?: Error): MockedResponse {
  return {
    request: {
      query: MoveAppointmentMutation,
      variables: {
        input: { id: "a1", professionalId: "p2", startsAt: NEW_START.toISOString() },
      },
    },
    ...(error ? { error } : { result }),
  };
}

describe("useMoveAppointment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sucesso: cache fica na nova raia/horario e nao ha toast de erro", async () => {
    const moved = {
      ...appointment,
      __typename: "Appointment",
      professionalId: "p2",
      professional: { __typename: "Member", id: "p2", displayName: "Carla" },
      client: { __typename: "Client", ...appointment.client },
      service: { __typename: "Service", id: "s1", name: "Corte", defaultDurationMinutes: 60, category: null },
      startsAt: NEW_START.toISOString(),
      endsAt: new Date(2026, 10, 4, 13, 0).toISOString(),
    };
    const { hook, read } = setup([
      mockFor({
        data: {
          moveAppointment: {
            __typename: "AppointmentPayload",
            appointment: moved,
            errors: [],
          },
        },
      }),
    ]);
    let ok = false;
    await act(async () => {
      ok = await hook.result.current(appointment, target);
    });
    expect(ok).toBe(true);
    expect(read()?.professionalId).toBe("p2");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("recusa do servidor: volta ao original e mostra o motivo", async () => {
    const { hook, read } = setup([
      mockFor({
        data: {
          moveAppointment: {
            __typename: "AppointmentPayload",
            appointment: null,
            errors: [
              {
                __typename: "UserError",
                code: "SLOT_TAKEN",
                message: "Horário já reservado por outra pessoa — escolha outro slot",
                field: null,
              },
            ],
          },
        },
      }),
    ]);
    let ok = true;
    await act(async () => {
      ok = await hook.result.current(appointment, target);
    });
    expect(ok).toBe(false);
    expect(read()?.professionalId).toBe("p1");
    expect(read()?.startsAt).toBe(appointment.startsAt);
    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível mover: Horário já reservado por outra pessoa — escolha outro slot",
    );
  });

  it("erro de rede: volta ao original e mostra a mensagem", async () => {
    const { hook, read } = setup([mockFor(undefined, new Error("rede caiu"))]);
    let ok = true;
    await act(async () => {
      ok = await hook.result.current(appointment, target);
    });
    expect(ok).toBe(false);
    expect(read()?.professionalId).toBe("p1");
    expect(toast.error).toHaveBeenCalledWith("Não foi possível mover: rede caiu");
  });
});
