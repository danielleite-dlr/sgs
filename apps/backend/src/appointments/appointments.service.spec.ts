import { parseAppointmentInterval } from "./appointments.service";

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
