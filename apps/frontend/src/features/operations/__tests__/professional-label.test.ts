import { describe, expect, it } from "vitest";
import { shortProfessionalName } from "../lib/professional-label";

describe("shortProfessionalName (UX-02)", () => {
  it("usa o primeiro nome e a inicial do segundo", () => {
    expect(shortProfessionalName("Maria Aparecida Silva")).toBe("Maria A.");
  });

  it("mantém nome único como está", () => {
    expect(shortProfessionalName("Ana")).toBe("Ana");
  });

  it("nome vazio vira ?", () => {
    expect(shortProfessionalName("")).toBe("?");
    expect(shortProfessionalName("   ")).toBe("?");
  });

  it("nomes em caixa alta saem em caixa normal", () => {
    expect(shortProfessionalName("JOANA PAULA")).toBe("Joana P.");
  });

  it("preserva acentos", () => {
    expect(shortProfessionalName("ÉRICA ÁVILA")).toBe("Érica Á.");
  });
});
