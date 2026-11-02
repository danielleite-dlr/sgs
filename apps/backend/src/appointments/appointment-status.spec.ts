import {
  BLOCKING_STATUSES,
  CANCELLABLE_STATUSES,
  MOVABLE_STATUSES,
  canTransition,
} from "./appointment-status";

describe("appointment-status", () => {
  it("transições permitidas", () => {
    expect(canTransition("scheduled", "confirmed")).toBe(true);
    expect(canTransition("scheduled", "in_progress")).toBe(true);
    expect(canTransition("confirmed", "in_progress")).toBe(true);
  });
  it("transições proibidas", () => {
    expect(canTransition("in_progress", "confirmed")).toBe(false);
    expect(canTransition("completed", "in_progress")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });
  it("listas de status", () => {
    expect([...BLOCKING_STATUSES]).toEqual(["scheduled", "confirmed", "in_progress", "completed"]);
    expect([...MOVABLE_STATUSES]).toEqual(["scheduled", "confirmed", "in_progress"]);
    expect([...CANCELLABLE_STATUSES]).toEqual(["scheduled", "confirmed", "in_progress"]);
  });
});
