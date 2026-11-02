import { Prisma } from "@prisma/client";
import {
  SLOT_TAKEN_MESSAGE,
  SchedulingError,
  mapSchedulingError,
} from "./scheduling-guard";

describe("mapSchedulingError", () => {
  it("55P03 vira SLOT_TAKEN", () => {
    const e = new Prisma.PrismaClientKnownRequestError("x", {
      code: "P2010",
      clientVersion: "6",
      meta: { code: "55P03" },
    });
    expect(mapSchedulingError(e)).toEqual({
      code: "SLOT_TAKEN",
      message: SLOT_TAKEN_MESSAGE,
      field: "startsAt",
    });
  });
  it("SchedulingError preserva code/message/field", () => {
    expect(mapSchedulingError(new SchedulingError("TIME_BLOCKED", "x", "startsAt"))).toEqual({
      code: "TIME_BLOCKED",
      message: "x",
      field: "startsAt",
    });
  });
  it("outros erros viram null", () => {
    expect(mapSchedulingError(new Error("boom"))).toBeNull();
  });
});
