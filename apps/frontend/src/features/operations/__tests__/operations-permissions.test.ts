import { describe, expect, it } from "vitest";
import { roleHasPermission } from "../operations-permissions";

describe("roleHasPermission (espelha ROLE_PERMISSIONS do backend)", () => {
  it("ATTENDANT lança e fecha comanda, mas não reabre nem vê o financeiro", () => {
    expect(roleHasPermission("ATTENDANT", "comanda.write")).toBe(true);
    expect(roleHasPermission("ATTENDANT", "comanda.close")).toBe(true);
    expect(roleHasPermission("ATTENDANT", "comanda.reopen")).toBe(false);
    expect(roleHasPermission("ATTENDANT", "financial.read")).toBe(false);
    expect(roleHasPermission("ATTENDANT", "credit.adjust")).toBe(false);
  });

  it("MANAGER reabre e ajusta crédito; só ADMIN revisa regras de comissão", () => {
    expect(roleHasPermission("MANAGER", "comanda.reopen")).toBe(true);
    expect(roleHasPermission("MANAGER", "credit.adjust")).toBe(true);
    expect(roleHasPermission("MANAGER", "commission.write")).toBe(false);
    expect(roleHasPermission("ADMIN", "commission.write")).toBe(true);
  });

  it("PROFESSIONAL só lê comanda e as próprias comissões", () => {
    expect(roleHasPermission("PROFESSIONAL", "comanda.read")).toBe(true);
    expect(roleHasPermission("PROFESSIONAL", "commissionRecord.read")).toBe(true);
    expect(roleHasPermission("PROFESSIONAL", "comanda.write")).toBe(false);
    expect(roleHasPermission("PROFESSIONAL", "financial.read")).toBe(false);
  });

  it("papel ausente ou desconhecido não tem permissão", () => {
    expect(roleHasPermission(null, "comanda.read")).toBe(false);
    expect(roleHasPermission("OUTRO", "comanda.read")).toBe(false);
  });
});
