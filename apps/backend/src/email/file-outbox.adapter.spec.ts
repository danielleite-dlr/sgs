import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileOutboxEmailAdapter, shouldUseOutbox } from "./file-outbox.adapter";

describe("FileOutboxEmailAdapter", () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(await mkdtemp(join(tmpdir(), "sgs-outbox-")), "nested");
  });

  afterEach(async () => {
    await rm(join(dir, ".."), { recursive: true, force: true });
  });

  it("writes one JSON file per email, creating the directory", async () => {
    const adapter = new FileOutboxEmailAdapter(dir);
    await adapter.send({
      to: "a@example.com",
      subject: "Oi",
      text: "texto",
      html: "<p>html</p>",
    });

    const files = await readdir(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.json$/);
    const body = JSON.parse(await readFile(join(dir, files[0]), "utf8"));
    expect(body).toMatchObject({
      to: "a@example.com",
      subject: "Oi",
      text: "texto",
      html: "<p>html</p>",
    });
    expect(Number.isNaN(Date.parse(body.sentAt))).toBe(false);
  });

  it("generates distinct, time-sortable file names for consecutive sends", async () => {
    const adapter = new FileOutboxEmailAdapter(dir);
    await adapter.send({ to: "a@example.com", subject: "1", html: "x" });
    await new Promise((r) => setTimeout(r, 5));
    await adapter.send({ to: "a@example.com", subject: "2", html: "x" });

    const files = await readdir(dir);
    expect(new Set(files).size).toBe(2);
    expect([...files].sort()).toEqual(files.sort());
    const first = JSON.parse(
      await readFile(join(dir, [...files].sort()[0]), "utf8"),
    );
    expect(first.subject).toBe("1");
  });
});

describe("shouldUseOutbox", () => {
  it("is true only with a non-empty dir outside production", () => {
    expect(shouldUseOutbox("test", "/tmp/x")).toBe(true);
    expect(shouldUseOutbox("development", "/tmp/x")).toBe(true);
    expect(shouldUseOutbox(undefined, "/tmp/x")).toBe(true);
  });

  it("is false without dir", () => {
    expect(shouldUseOutbox("test", undefined)).toBe(false);
    expect(shouldUseOutbox("test", "")).toBe(false);
    expect(shouldUseOutbox("test", "   ")).toBe(false);
  });

  it("is false in production even when the dir is set", () => {
    expect(shouldUseOutbox("production", "/tmp/x")).toBe(false);
  });
});
