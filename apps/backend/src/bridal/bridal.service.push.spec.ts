import { BridalError } from "./bridal-errors";
import { BridalService } from "./bridal.service";

const ORG = "org-1";
const MEMBER = "member-1";

function setup(runWithTenant: jest.Mock) {
  const push = { enqueue: jest.fn() };
  const svc = new BridalService({ runWithTenant } as never, push as never);
  return { svc, push, runWithTenant };
}

describe("BridalService — ganchos de push", () => {
  it("schedule enfileira um bridal.scheduled com todos os ids", async () => {
    const run = jest.fn().mockResolvedValue({
      group: {},
      appointmentIds: ["b1", "b2", "b3"],
      errors: [],
    });
    const { svc, push } = setup(run);
    await svc.schedule(ORG, MEMBER, { groupId: "g1", items: [] } as never);
    expect(push.enqueue).toHaveBeenCalledTimes(1);
    expect(push.enqueue).toHaveBeenCalledWith({
      kind: "bridal.scheduled",
      orgId: ORG,
      actorMemberId: MEMBER,
      appointmentIds: ["b1", "b2", "b3"],
    });
    expect(push.enqueue.mock.invocationCallOrder[0]).toBeGreaterThan(
      run.mock.invocationCallOrder[0],
    );
  });

  it("schedule com erro mapeado não enfileira", async () => {
    const run = jest
      .fn()
      .mockRejectedValue(new BridalError("GROUP_NOT_FOUND", "sem grupo", null));
    const { svc, push } = setup(run);
    const r = await svc.schedule(ORG, MEMBER, {
      groupId: "g1",
      items: [],
    } as never);
    expect(r.errors).toHaveLength(1);
    expect(push.enqueue).not.toHaveBeenCalled();
  });

  it("cancelGroup enfileira bridal.cancelled com since capturado antes", async () => {
    const before = Date.now();
    const run = jest.fn().mockResolvedValue({ group: {}, errors: [] });
    const { svc, push } = setup(run);
    await svc.cancelGroup(ORG, MEMBER, { id: "g1", reason: "evento desfeito" });
    expect(push.enqueue).toHaveBeenCalledTimes(1);
    const job = push.enqueue.mock.calls[0][0];
    expect(job).toMatchObject({
      kind: "bridal.cancelled",
      orgId: ORG,
      actorMemberId: MEMBER,
      groupId: "g1",
    });
    expect(new Date(job.since).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(job.since).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("cancelGroup que falha (contrato vivo) ou sem motivo não enfileira", async () => {
    const run = jest
      .fn()
      .mockRejectedValue(
        new BridalError("CANCEL_CONTRACT_FIRST", "cancele o contrato", "id"),
      );
    const { svc, push } = setup(run);
    const r1 = await svc.cancelGroup(ORG, MEMBER, {
      id: "g1",
      reason: "evento desfeito",
    });
    expect(r1.errors).toHaveLength(1);
    const r2 = await svc.cancelGroup(ORG, MEMBER, { id: "g1", reason: "x" });
    expect(r2.errors[0].code).toBe("REASON_REQUIRED");
    expect(push.enqueue).not.toHaveBeenCalled();
  });
});
