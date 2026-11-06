import { describe, expect, it } from "vitest";
import { roleHasPermission } from "../operations-permissions";
import {
  CashForecastQuery,
  FORECAST_COST_GROUP_LABELS,
  FORECAST_KIND_LABELS,
  forecastWindow,
  weekLabel,
} from "../api/forecast.api";

describe("financial.expenseWrite", () => {
  it("só ADMIN e MANAGER gravam despesas fixas", () => {
    expect(roleHasPermission("ADMIN", "financial.expenseWrite")).toBe(true);
    expect(roleHasPermission("MANAGER", "financial.expenseWrite")).toBe(true);
    expect(roleHasPermission("ATTENDANT", "financial.expenseWrite")).toBe(false);
    expect(roleHasPermission("PROFESSIONAL", "financial.expenseWrite")).toBe(false);
  });
});

describe("helpers de previsão", () => {
  it("forecastWindow usa o dia do fuso da org, não o UTC", () => {
    expect(forecastWindow("America/Sao_Paulo", new Date("2026-11-06T01:30:00Z"))).toEqual({
      from: "2026-11-05",
      to: "2026-12-05",
    });
  });
  it("weekLabel mostra o último dia inclusivo", () => {
    expect(weekLabel("2026-11-05", "2026-11-12")).toBe("05/11 – 11/11");
  });
});

describe("grupos de custo da previsão", () => {
  it("rótulos em português", () => {
    expect(FORECAST_COST_GROUP_LABELS).toEqual({
      professional: "Custo profissional",
      operational: "Custo operacional",
      fixed: "Custo fixo",
    });
    expect(FORECAST_KIND_LABELS.package_cost).toBe("Outro custo do pacote");
  });

  it("a consulta pede os totais por grupo, os da semana e o grupo do item", () => {
    const text = CashForecastQuery.loc?.source.body ?? "";
    for (const f of [
      "professionalOutflowTotal",
      "operationalOutflowTotal",
      "fixedOutflowTotal",
      "professionalOutflow",
      "operationalOutflow",
      "fixedOutflow",
      "costGroup",
    ]) {
      expect(text).toContain(f);
    }
  });
});
