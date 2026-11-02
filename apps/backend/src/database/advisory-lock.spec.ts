import { Prisma } from "@prisma/client";
import {
  isExclusionViolation,
  isLockTimeout,
  isPgError,
  professionalLockKey,
} from "./advisory-lock";

const known = (code: string, meta?: Record<string, unknown>, message = "x") =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "6",
    meta,
  });

describe("advisory-lock helpers", () => {
  it("reconhece SQLSTATE em meta.code", () => {
    expect(isPgError(known("P2010", { code: "55P03" }), "55P03")).toBe(true);
    expect(isLockTimeout(known("P2010", { code: "55P03" }))).toBe(true);
  });

  it("reconhece SQLSTATE na mensagem", () => {
    expect(isPgError(known("P2010", undefined, "ERROR 23P01 boom"), "23P01")).toBe(true);
  });

  it("ignora erros que não são PrismaClientKnownRequestError", () => {
    expect(isPgError(new Error("55P03"), "55P03")).toBe(false);
    expect(isLockTimeout(null)).toBe(false);
  });

  it("não confunde SQLSTATEs", () => {
    expect(isLockTimeout(known("P2010", { code: "23P01" }))).toBe(false);
  });

  it("exclusion violation aceita 23P01 e P2004", () => {
    expect(isExclusionViolation(known("P2010", { code: "23P01" }))).toBe(true);
    expect(isExclusionViolation(known("P2004"))).toBe(true);
    expect(isExclusionViolation(known("P2002"))).toBe(false);
  });

  it("chave do lock do profissional é estável", () => {
    expect(professionalLockKey("o", "p")).toBe("sgs:sched:pro:o:p");
  });
});
