import type { TenantContext } from "../authz/decorators/current-tenant.decorator";
import {
  AppointmentsResolver,
  scopeProfessionalFilter,
} from "./appointments.resolver";
import type { AppointmentsService } from "./appointments.service";

const tenant = (roleName: string): TenantContext => ({
  organizationId: "org-1",
  memberId: "me",
  roleName,
});

describe("scopeProfessionalFilter", () => {
  it("PROFESSIONAL always sees only their own appointments", () => {
    expect(scopeProfessionalFilter(tenant("PROFESSIONAL"))).toBe("me");
    expect(scopeProfessionalFilter(tenant("PROFESSIONAL"), "other")).toBe("me");
  });

  it.each(["ADMIN", "MANAGER", "ATTENDANT"])(
    "%s keeps the requested filter (or none)",
    (role) => {
      expect(scopeProfessionalFilter(tenant(role))).toBeUndefined();
      expect(scopeProfessionalFilter(tenant(role), "other")).toBe("other");
    },
  );
});

describe("AppointmentsResolver.list", () => {
  it("passes the scoped professionalId to the service", async () => {
    const list = jest.fn().mockResolvedValue([]);
    const resolver = new AppointmentsResolver({
      list,
    } as unknown as AppointmentsService);
    const startsAt = new Date("2026-01-01T00:00:00Z");
    const endsAt = new Date("2026-01-02T00:00:00Z");

    await resolver.list(tenant("PROFESSIONAL"), startsAt, endsAt, "other");
    expect(list).toHaveBeenLastCalledWith("org-1", {
      startsAt,
      endsAt,
      professionalId: "me",
    });

    await resolver.list(tenant("MANAGER"), startsAt, endsAt, undefined);
    expect(list).toHaveBeenLastCalledWith("org-1", {
      startsAt,
      endsAt,
      professionalId: undefined,
    });
  });
});
