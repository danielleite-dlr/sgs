import { BadRequestException } from "@nestjs/common";
import {
  DeviceTokensService,
  validateDeviceTokenInput,
} from "./device-tokens.service";

describe("validateDeviceTokenInput", () => {
  const ok = { token: "abc", platform: "android" };
  it("aceita entrada válida", () => {
    expect(validateDeviceTokenInput(ok)).toBeNull();
    expect(
      validateDeviceTokenInput({ ...ok, provider: "fcm", appVersion: "1.0.0" }),
    ).toBeNull();
  });
  it("rejeita token vazio ou grande demais", () => {
    expect(validateDeviceTokenInput({ ...ok, token: "  " })?.field).toBe(
      "token",
    );
    expect(
      validateDeviceTokenInput({ ...ok, token: "x".repeat(4097) })?.message,
    ).toBe("Token do aparelho inválido.");
  });
  it("rejeita plataforma, provedor e versão inválidos", () => {
    expect(validateDeviceTokenInput({ ...ok, platform: "web" })?.message).toBe(
      "Plataforma inválida.",
    );
    expect(validateDeviceTokenInput({ ...ok, provider: "apns" })?.message).toBe(
      "Provedor de push inválido.",
    );
    expect(
      validateDeviceTokenInput({ ...ok, appVersion: "v".repeat(21) })?.message,
    ).toBe("Versão do app inválida.");
  });
});

describe("validateDeviceTokenInput - webpush", () => {
  const ok = {
    token: "https://web.push.apple.com/QKfake-endpoint-p8",
    platform: "ios",
    provider: "webpush",
    p256dh: "B" + "a".repeat(86),
    auth: "c".repeat(22),
  };
  it("aceita inscrição válida e fcm sem chaves", () => {
    expect(validateDeviceTokenInput(ok)).toBeNull();
    expect(
      validateDeviceTokenInput({ token: "abc", platform: "android" }),
    ).toBeNull();
  });
  it("rejeita plataforma diferente de ios", () => {
    expect(
      validateDeviceTokenInput({ ...ok, platform: "android" })?.field,
    ).toBe("platform");
  });
  it.each([
    "http://web.push.apple.com/x",
    "https://127.0.0.1/x",
    "https://evil.com/x",
    "https://web.push.apple.com.evil.com/x",
    "https://user:pw@web.push.apple.com/x",
    "https://web.push.apple.com:8443/x",
    "https://web.push.apple.com/" + "a".repeat(2030),
    "isto nao e url",
  ])("rejeita endpoint %s", (token) => {
    expect(validateDeviceTokenInput({ ...ok, token })?.field).toBe("token");
  });
  it("rejeita chaves ausentes ou malformadas", () => {
    expect(validateDeviceTokenInput({ ...ok, p256dh: null })?.field).toBe(
      "p256dh",
    );
    expect(validateDeviceTokenInput({ ...ok, auth: null })?.field).toBe("auth");
    expect(
      validateDeviceTokenInput({ ...ok, p256dh: "a".repeat(86) })?.field,
    ).toBe("p256dh");
    expect(
      validateDeviceTokenInput({ ...ok, auth: "c".repeat(21) + "+" })?.field,
    ).toBe("auth");
  });
});

describe("DeviceTokensService", () => {
  const tx = {
    deviceToken: { deleteMany: jest.fn(), upsert: jest.fn() },
  };
  const tenant = {
    runWithTenant: jest.fn((_org: string, fn: (t: typeof tx) => unknown) =>
      fn(tx),
    ),
  };
  let svc: DeviceTokensService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new DeviceTokensService(tenant as never);
  });

  it("register: apaga o token de outras usuárias antes do upsert", async () => {
    const r = await svc.register("org", "m1", {
      token: "tok",
      platform: "android",
      appVersion: "1.2.3",
    });
    expect(r).toBe(true);
    expect(tx.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { provider: "fcm", token: "tok", memberId: { not: "m1" } },
    });
    const upsertArg = tx.deviceToken.upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({
      uq_device_tokens_org_provider_token: {
        organizationId: "org",
        provider: "fcm",
        token: "tok",
      },
    });
    expect(upsertArg.update).toMatchObject({
      memberId: "m1",
      platform: "android",
      appVersion: "1.2.3",
    });
    expect(upsertArg.update.lastSeenAt).toBeInstanceOf(Date);
    expect(tx.deviceToken.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.deviceToken.upsert.mock.invocationCallOrder[0],
    );
  });

  it("register: entrada inválida lança BadRequestException em pt-BR", async () => {
    await expect(
      svc.register("org", "m1", { token: "t", platform: "web" }),
    ).rejects.toThrow(new BadRequestException("Plataforma inválida."));
    expect(tenant.runWithTenant).not.toHaveBeenCalled();
  });

  it("unregister: remove só o token da própria usuária", async () => {
    expect(await svc.unregister("org", "m1", "tok")).toBe(true);
    expect(tx.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: "tok", memberId: "m1" },
    });
  });

  it("unregister: token vazio devolve false sem tocar no banco", async () => {
    expect(await svc.unregister("org", "m1", " ")).toBe(false);
    expect(tenant.runWithTenant).not.toHaveBeenCalled();
  });

  it("register webpush: grava p256dh/auth no create e no update; fcm grava NULL", async () => {
    const p256dh = "B" + "a".repeat(86);
    const auth = "c".repeat(22);
    await svc.register("org", "m1", {
      token: "https://web.push.apple.com/QKfake",
      platform: "ios",
      provider: "webpush",
      p256dh,
      auth,
    });
    const a = tx.deviceToken.upsert.mock.calls[0][0];
    expect(a.create).toMatchObject({ provider: "webpush", p256dh, auth });
    expect(a.update).toMatchObject({ p256dh, auth });

    await svc.register("org", "m1", { token: "tok", platform: "android" });
    const b = tx.deviceToken.upsert.mock.calls[1][0];
    expect(b.create).toMatchObject({ p256dh: null, auth: null });
    expect(b.update).toMatchObject({ p256dh: null, auth: null });
  });

  it("register webpush com endpoint fora da lista lança e não toca no banco", async () => {
    await expect(
      svc.register("org", "m1", {
        token: "https://evil.com/x",
        platform: "ios",
        provider: "webpush",
        p256dh: "B" + "a".repeat(86),
        auth: "c".repeat(22),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tenant.runWithTenant).not.toHaveBeenCalled();
  });
});
