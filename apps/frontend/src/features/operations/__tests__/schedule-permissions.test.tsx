import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import { MemoryRouter } from "react-router-dom";
import { MembersQuery } from "@/features/catalog/api/members.api";
import { AppointmentsQuery } from "../api/appointments.api";
import { SchedulePage } from "../pages/SchedulePage";
import { useAuthStore } from "@/infrastructure/stores/auth.store";
import {
  canWriteAppointments,
  seesOnlyOwnAppointments,
} from "../schedule-permissions";

describe("schedule permissions", () => {
  it("só ADMIN, MANAGER e ATTENDANT agendam", () => {
    expect(canWriteAppointments("ADMIN")).toBe(true);
    expect(canWriteAppointments("MANAGER")).toBe(true);
    expect(canWriteAppointments("ATTENDANT")).toBe(true);
    expect(canWriteAppointments("PROFESSIONAL")).toBe(false);
    expect(canWriteAppointments(null)).toBe(false);
  });

  it("só o PROFESSIONAL fica restrito aos próprios atendimentos", () => {
    expect(seesOnlyOwnAppointments("PROFESSIONAL")).toBe(true);
    for (const role of ["ADMIN", "MANAGER", "ATTENDANT", null]) {
      expect(seesOnlyOwnAppointments(role)).toBe(false);
    }
  });
});

const members = [
  {
    id: "me",
    displayName: "Ana Prof",
    email: "ana@x.com",
    roleName: "PROFESSIONAL",
    seniorityTier: null,
    isProfessional: true,
  },
  {
    id: "other",
    displayName: "Bia Outra",
    email: "bia@x.com",
    roleName: "PROFESSIONAL",
    seniorityTier: null,
    isProfessional: true,
  },
];

function renderSchedule(
  onAppointmentsVars: (vars: Record<string, unknown>) => void,
) {
  const mocks: MockedResponse[] = [
    { request: { query: MembersQuery }, result: { data: { members } } },
    {
      request: { query: AppointmentsQuery },
      variableMatcher: (vars) => {
        onAppointmentsVars(vars as Record<string, unknown>);
        return true;
      },
      result: { data: { appointments: [] } },
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

describe("SchedulePage por papel", () => {
  beforeEach(() => {
    useAuthStore.setState({ memberId: "me" });
  });

  it("PROFESSIONAL vê só a própria coluna, sem agendar, e pede só os próprios atendimentos", async () => {
    useAuthStore.setState({ roleName: "PROFESSIONAL" });
    const seen = vi.fn();
    renderSchedule(seen);

    expect(await screen.findByTitle("Ana Prof")).toBeInTheDocument();
    expect(screen.queryByTitle("Bia Outra")).toBeNull();
    expect(
      screen.queryAllByRole("button", { name: /^Cadastrar agendamento/ }),
    ).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Agendar" })).toBeNull();
    expect(screen.queryByText("Buscar e Agendar")).toBeNull();
    expect(screen.queryByText("Seleção de Profissionais")).toBeNull();
    await waitFor(() =>
      expect(seen).toHaveBeenCalledWith(
        expect.objectContaining({ professionalId: "me" }),
      ),
    );
  });

  it("ATTENDANT vê todos os profissionais e pode agendar", async () => {
    useAuthStore.setState({ roleName: "ATTENDANT" });
    const seen = vi.fn();
    renderSchedule(seen);

    expect(await screen.findByTitle("Bia Outra")).toBeInTheDocument();
    expect(screen.getByTitle("Ana Prof")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^Cadastrar agendamento/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
    await waitFor(() =>
      expect(seen).toHaveBeenCalledWith(
        expect.objectContaining({ professionalId: null }),
      ),
    );
  });
});
