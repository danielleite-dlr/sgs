import { AppointmentsService } from "./appointments.service";
import { SchedulingError } from "./scheduling-guard";

const ORG = "org-1";
const MEMBER = "member-1";

function setup(runWithTenant: jest.Mock) {
  const push = { enqueue: jest.fn() };
  const svc = new AppointmentsService(
    { runWithTenant } as never,
    push as never,
  );
  return { svc, push, runWithTenant };
}

const visitInput = {} as never;

describe("AppointmentsService — ganchos de push", () => {
  it("createVisit enfileira appointment.created depois do commit", async () => {
    const run = jest.fn().mockResolvedValue({
      appointments: [{ id: "a1" }, { id: "a2" }],
      comandaId: null,
      errors: [],
    });
    const { svc, push } = setup(run);
    await svc.createVisit(ORG, MEMBER, visitInput);
    expect(push.enqueue).toHaveBeenCalledTimes(1);
    expect(push.enqueue).toHaveBeenCalledWith({
      kind: "appointment.created",
      orgId: ORG,
      actorMemberId: MEMBER,
      appointmentIds: ["a1", "a2"],
    });
    expect(push.enqueue.mock.invocationCallOrder[0]).toBeGreaterThan(
      run.mock.invocationCallOrder[0],
    );
  });

  it("createVisit com erro mapeado não enfileira", async () => {
    const run = jest
      .fn()
      .mockRejectedValue(new SchedulingError("SLOT_TAKEN", "ocupado", null));
    const { svc, push } = setup(run);
    const r = await svc.createVisit(ORG, MEMBER, visitInput);
    expect(r.errors).toHaveLength(1);
    expect(push.enqueue).not.toHaveBeenCalled();
  });

  it("createVisit com erro não mapeado propaga e não enfileira", async () => {
    const run = jest.fn().mockRejectedValue(new Error("boom"));
    const { svc, push } = setup(run);
    await expect(svc.createVisit(ORG, MEMBER, visitInput)).rejects.toThrow(
      "boom",
    );
    expect(push.enqueue).not.toHaveBeenCalled();
  });

  it("push.enqueue que lança não derruba a mutation", async () => {
    const run = jest.fn().mockResolvedValue({
      appointments: [{ id: "a1" }],
      comandaId: null,
      errors: [],
    });
    const { svc, push } = setup(run);
    push.enqueue.mockImplementation(() => {
      throw new Error("redis fora");
    });
    const r = await svc.createVisit(ORG, MEMBER, visitInput);
    expect(r.appointments).toHaveLength(1);
  });

  it("cancel enfileira appointment.cancelled", async () => {
    const run = jest
      .fn()
      .mockResolvedValue({ appointment: { id: "a1" }, errors: [] });
    const { svc, push } = setup(run);
    await svc.cancel(ORG, MEMBER, { id: "a1", reason: "cliente desistiu" });
    expect(push.enqueue).toHaveBeenCalledWith({
      kind: "appointment.cancelled",
      orgId: ORG,
      actorMemberId: MEMBER,
      appointmentIds: ["a1"],
    });
    expect(push.enqueue.mock.invocationCallOrder[0]).toBeGreaterThan(
      run.mock.invocationCallOrder[0],
    );
  });

  it("cancel como no_show não avisa", async () => {
    const run = jest
      .fn()
      .mockResolvedValue({ appointment: { id: "a1" }, errors: [] });
    const { svc, push } = setup(run);
    await svc.cancel(ORG, MEMBER, {
      id: "a1",
      reason: "não compareceu",
      reasonTag: "no_show",
    });
    expect(push.enqueue).not.toHaveBeenCalled();
  });

  it("cancel com motivo curto não avisa nem abre transação", async () => {
    const run = jest.fn();
    const { svc, push } = setup(run);
    const r = await svc.cancel(ORG, MEMBER, { id: "a1", reason: "x" });
    expect(r.errors[0].code).toBe("REASON_REQUIRED");
    expect(run).not.toHaveBeenCalled();
    expect(push.enqueue).not.toHaveBeenCalled();
  });

  it("cancel com erro mapeado não avisa", async () => {
    const run = jest
      .fn()
      .mockRejectedValue(new SchedulingError("NOT_FOUND", "nada", "id"));
    const { svc, push } = setup(run);
    const r = await svc.cancel(ORG, MEMBER, { id: "a1", reason: "motivo ok" });
    expect(r.errors).toHaveLength(1);
    expect(push.enqueue).not.toHaveBeenCalled();
  });
});
