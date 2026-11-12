import {
  parseAppointmentInterval,
  serializeAppointment,
} from "./appointments.service";

describe("parseAppointmentInterval", () => {
  it("accepts a valid non-empty interval", () => {
    const interval = parseAppointmentInterval(
      "2026-09-20T10:00:00.000Z",
      "2026-09-20T11:00:00.000Z",
    );

    expect(interval?.startsAt.toISOString()).toBe("2026-09-20T10:00:00.000Z");
    expect(interval?.endsAt.toISOString()).toBe("2026-09-20T11:00:00.000Z");
  });

  it("rejects an empty or reversed interval", () => {
    expect(
      parseAppointmentInterval(
        "2026-09-20T10:00:00.000Z",
        "2026-09-20T10:00:00.000Z",
      ),
    ).toBeNull();
    expect(
      parseAppointmentInterval(
        "2026-09-20T11:00:00.000Z",
        "2026-09-20T10:00:00.000Z",
      ),
    ).toBeNull();
  });

  it("rejects invalid dates", () => {
    expect(
      parseAppointmentInterval("not-a-date", "2026-09-20T11:00:00.000Z"),
    ).toBeNull();
  });
});

// quick 261112-cko: a agenda filtra por noiva e acompanhantes pelo grupo do atendimento.
describe("serializeAppointment — grupo de noiva", () => {
  const group = {
    name: "Noiva Nathá",
    eventKind: "noiva",
    members: [
      { clientId: "c-noiva", role: "bride" },
      { clientId: "c-mae", role: "companion" },
    ],
  };

  it("expõe nome, tipo e o papel da cliente no grupo", () => {
    const bride = serializeAppointment({ clientId: "c-noiva", bridalGroup: group });
    const companion = serializeAppointment({ clientId: "c-mae", bridalGroup: group });
    expect(bride).toMatchObject({
      bridalGroupName: "Noiva Nathá",
      bridalEventKind: "noiva",
      bridalRole: "bride",
    });
    expect(companion).toMatchObject({ bridalRole: "companion" });
  });

  it("cliente fora da lista do grupo fica sem papel; atendimento social fica sem grupo", () => {
    expect(
      serializeAppointment({ clientId: "c-outra", bridalGroup: group }).bridalRole,
    ).toBeNull();
    expect(
      serializeAppointment({ clientId: "c-social", bridalGroup: null }),
    ).toMatchObject({ bridalGroupName: null, bridalEventKind: null, bridalRole: null });
  });
});
