import {
  FORECAST_APPOINTMENT_STATUSES,
  FORECAST_HORIZON_DAYS,
  addDaysIso,
  appointmentInflowCents,
  buildWeeklyBuckets,
  costGroupOf,
  sumOutflowByCostGroup,
  type ForecastKind,
  contractReceivables,
  expandFixedExpenses,
  fallbackCommission,
  summarizeForecast,
  type ForecastItemCents,
} from "./forecast";
import type { RuleLite } from "./commission-resolver";

const exp = (dueDay: number, active = true) => ({
  id: "e1",
  name: "Aluguel",
  cents: 100000,
  dueDay,
  active,
});

describe("constantes", () => {
  it("status e horizonte", () => {
    expect(FORECAST_APPOINTMENT_STATUSES).toEqual(["scheduled", "confirmed"]);
    expect(FORECAST_HORIZON_DAYS).toBe(30);
  });
  it("addDaysIso", () => {
    expect(addDaysIso("2027-02-26", 5)).toBe("2027-03-03");
  });
});

describe("expandFixedExpenses", () => {
  it("dia 31 cai em 2027-02-28", () => {
    const r = expandFixedExpenses([exp(31)], "2027-02-10", "2027-03-12");
    expect(r.map((i) => i.date)).toEqual(["2027-02-28"]);
    expect(r[0]).toMatchObject({
      kind: "fixed_expense",
      direction: "out",
      cents: 100000,
    });
  });
  it("dia 5 em janela jan-fev", () => {
    const r = expandFixedExpenses([exp(5)], "2027-01-20", "2027-02-19");
    expect(r.map((i) => i.date)).toEqual(["2027-02-05"]);
  });
  it("inativa nunca entra", () => {
    expect(
      expandFixedExpenses([exp(5, false)], "2027-01-01", "2027-03-01"),
    ).toEqual([]);
  });
  it("janela cruzando ano", () => {
    const r = expandFixedExpenses([exp(1)], "2026-12-20", "2027-01-19");
    expect(r.map((i) => i.date)).toEqual(["2027-01-01"]);
  });
  it("to é exclusivo", () => {
    expect(expandFixedExpenses([exp(19)], "2027-01-20", "2027-02-19")).toEqual(
      [],
    );
  });
});

describe("contractReceivables", () => {
  const from = "2027-03-01";
  const to = "2027-03-31";
  const base = {
    contractId: "c1",
    code: "C-1",
    installments: [
      { seq: 1, dueDate: "2027-02-19", cents: 50000 },
      { seq: 2, dueDate: "2027-03-06", cents: 50000 },
    ],
    netPaidCents: 0,
    depositCents: 100000,
    totalCents: 300000,
    balanceDueDate: "2027-03-20",
  };
  it("pagamento 500 quita só a 1a", () => {
    const r = contractReceivables(
      { ...base, netPaidCents: 50000 },
      from,
      to,
    ).filter((i) => i.kind === "contract_installment");
    expect(r).toHaveLength(1);
    expect(r[0].date).toBe("2027-03-06");
    expect(r[0].overdue).toBe(false);
  });
  it("pagamento 0: vencida vira from com overdue (D-09)", () => {
    const r = contractReceivables(base, from, to).filter(
      (i) => i.kind === "contract_installment",
    );
    expect(r.map((i) => i.date)).toEqual([from, "2027-03-06"]);
    expect(r[0].overdue).toBe(true);
    expect(r[1].overdue).toBe(false);
  });
  it("parcela em/depois de to não entra", () => {
    const r = contractReceivables(
      { ...base, installments: [{ seq: 1, dueDate: to, cents: 100 }] },
      from,
      to,
    );
    expect(r.filter((i) => i.kind === "contract_installment")).toEqual([]);
  });
  it("restante entra em balanceDueDate", () => {
    const r = contractReceivables(base, from, to).filter(
      (i) => i.kind === "contract_balance",
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      date: "2027-03-20",
      cents: 200000,
      overdue: false,
    });
  });
  it("restante vencido entra em from com overdue", () => {
    const r = contractReceivables(
      { ...base, balanceDueDate: "2027-02-01" },
      from,
      to,
    ).filter((i) => i.kind === "contract_balance");
    expect(r[0]).toMatchObject({ date: from, overdue: true });
  });
  it("restante fora da janela não entra", () => {
    const r = contractReceivables(
      { ...base, balanceDueDate: "2027-04-10" },
      from,
      to,
    );
    expect(r.filter((i) => i.kind === "contract_balance")).toEqual([]);
  });
  it("estorno reabre parcela (net menor)", () => {
    const paid = contractReceivables(
      { ...base, netPaidCents: 100000 },
      from,
      to,
    );
    const reopened = contractReceivables(
      { ...base, netPaidCents: 50000 },
      from,
      to,
    );
    expect(paid.filter((i) => i.kind === "contract_installment")).toHaveLength(
      0,
    );
    expect(
      reopened.filter((i) => i.kind === "contract_installment"),
    ).toHaveLength(1);
  });
});

describe("appointmentInflowCents", () => {
  it("comanda com itens menos sinal", () => {
    expect(
      appointmentInflowCents({
        comandaItemCount: 2,
        comandaItemsCents: 12000,
        variantCents: null,
        baseCents: 10000,
        depositCents: 3000,
      }),
    ).toBe(9000);
  });
  it("comanda com itens de total 0 vale 0", () => {
    expect(
      appointmentInflowCents({
        comandaItemCount: 1,
        comandaItemsCents: 0,
        variantCents: 12000,
        baseCents: 10000,
        depositCents: 0,
      }),
    ).toBe(0);
  });
  it("comanda sem itens usa variante", () => {
    expect(
      appointmentInflowCents({
        comandaItemCount: 0,
        comandaItemsCents: 0,
        variantCents: 12000,
        baseCents: 10000,
        depositCents: 0,
      }),
    ).toBe(12000);
  });
  it("sem variante usa base", () => {
    expect(
      appointmentInflowCents({
        comandaItemCount: 0,
        comandaItemsCents: 0,
        variantCents: null,
        baseCents: 10000,
        depositCents: 0,
      }),
    ).toBe(10000);
  });
  it("sinal maior que valor dá 0", () => {
    expect(
      appointmentInflowCents({
        comandaItemCount: 0,
        comandaItemsCents: 0,
        variantCents: null,
        baseCents: 10000,
        depositCents: 20000,
      }),
    ).toBe(0);
  });
});

describe("fallbackCommission", () => {
  const rule = (
    o: Partial<RuleLite> &
      Pick<RuleLite, "id" | "scopeType" | "kind" | "value">,
  ): RuleLite => o;
  const amounts = { listUnitCents: 5000, quantity: 1, chargedCents: 5000 };
  const item = { serviceId: "s1", categoryChain: ["cat1"] };

  it("usa a regra default", () => {
    const r = fallbackCommission(
      [
        rule({ id: "d", scopeType: "default", kind: "percentage", value: "5" }),
        rule({
          id: "s",
          scopeType: "service",
          kind: "percentage",
          value: "20",
          serviceId: "s1",
        }),
      ],
      item,
      { listUnitCents: 10000, quantity: 1, chargedCents: 10000 },
    );
    expect(r).toEqual({ amountCents: 500, noRule: false, ruleId: "d" });
  });
  it("sem default pega a maior (fixa 15,00 > 20% de 50,00 = 10,00)", () => {
    const r = fallbackCommission(
      [
        rule({
          id: "s",
          scopeType: "service",
          kind: "percentage",
          value: "20",
          serviceId: "s1",
        }),
        rule({
          id: "m",
          scopeType: "member_service",
          kind: "fixed",
          value: "15.00",
          serviceId: "s1",
          memberId: "m1",
        }),
      ],
      item,
      amounts,
    );
    expect(r.amountCents).toBe(1500);
    expect(r.ruleId).toBe("m");
  });
  it("service 20% sozinha dá 1000", () => {
    const r = fallbackCommission(
      [
        rule({
          id: "s",
          scopeType: "service",
          kind: "percentage",
          value: "20",
          serviceId: "s1",
        }),
      ],
      item,
      amounts,
    );
    expect(r.amountCents).toBe(1000);
  });
  it("categoria da cadeia", () => {
    const r = fallbackCommission(
      [
        rule({
          id: "c",
          scopeType: "category",
          kind: "percentage",
          value: "10",
          categoryId: "cat1",
        }),
      ],
      item,
      amounts,
    );
    expect(r).toEqual({ amountCents: 500, noRule: false, ruleId: "c" });
  });
  it("nenhuma regra: noRule", () => {
    const r = fallbackCommission(
      [
        rule({
          id: "x",
          scopeType: "service",
          kind: "fixed",
          value: "9",
          serviceId: "outro",
        }),
      ],
      item,
      amounts,
    );
    expect(r).toEqual({ amountCents: 0, noRule: true, ruleId: null });
  });
  it("ignora regras apagadas", () => {
    const r = fallbackCommission(
      [
        rule({
          id: "d",
          scopeType: "default",
          kind: "percentage",
          value: "50",
          deletedAt: new Date(),
        }),
        rule({
          id: "s",
          scopeType: "service",
          kind: "percentage",
          value: "10",
          serviceId: "s1",
          deletedAt: new Date(),
        }),
      ],
      item,
      amounts,
    );
    expect(r.noRule).toBe(true);
  });
});

const it_ = (
  date: string,
  direction: "in" | "out",
  cents: number,
  overdue = false,
): ForecastItemCents => ({
  date,
  kind: direction === "in" ? "appointment" : "fixed_expense",
  direction,
  cents,
  label: "x",
  refId: null,
  overdue,
  noRule: false,
  withoutProfessional: false,
});

describe("buildWeeklyBuckets", () => {
  it("5 buckets 4x7 + 1x2", () => {
    const b = buildWeeklyBuckets(
      [
        it_("2027-03-30", "in", 700),
        it_("2027-03-01", "in", 100, true),
        it_("2027-03-08", "out", 50),
      ],
      "2027-03-01",
      "2027-03-31",
    );
    expect(b.map((x) => [x.start, x.end])).toEqual([
      ["2027-03-01", "2027-03-08"],
      ["2027-03-08", "2027-03-15"],
      ["2027-03-15", "2027-03-22"],
      ["2027-03-22", "2027-03-29"],
      ["2027-03-29", "2027-03-31"],
    ]);
    expect(b[4].inflowCents).toBe(700);
    expect(b[0].overdueInflowCents).toBe(100);
    expect(b[1].outflowCents).toBe(50);
    expect(b[1].balanceCents).toBe(-50);
  });
});

describe("summarizeForecast", () => {
  it("soma e saldo negativo", () => {
    const s = summarizeForecast([
      it_("2027-03-01", "in", 100, true),
      it_("2027-03-02", "in", 200),
      it_("2027-03-03", "out", 500),
    ]);
    expect(s).toEqual({
      inflowCents: 300,
      outflowCents: 500,
      balanceCents: -200,
      overdueInflowCents: 100,
      professionalOutflowCents: 0,
      operationalOutflowCents: 0,
      fixedOutflowCents: 500,
    });
  });
});

const out_ = (
  kind: ForecastKind,
  cents: number,
  date = "2027-03-03",
): ForecastItemCents => ({
  ...it_(date, "out", cents),
  kind,
});

describe("grupos de custo", () => {
  it("costGroupOf: saídas por tipo e entradas nulas", () => {
    expect(costGroupOf("commission", "out")).toBe("professional");
    expect(costGroupOf("package_cost", "out")).toBe("operational");
    expect(costGroupOf("fixed_expense", "out")).toBe("fixed");
    expect(costGroupOf("appointment", "in")).toBeNull();
    expect(costGroupOf("contract_balance", "in")).toBeNull();
  });

  it("sumOutflowByCostGroup ignora entradas", () => {
    const t = sumOutflowByCostGroup([
      out_("commission", 1000),
      out_("commission", 500),
      out_("package_cost", 20000),
      out_("fixed_expense", 300),
      it_("2027-03-03", "in", 99999),
    ]);
    expect(t).toEqual({
      professionalCents: 1500,
      operationalCents: 20000,
      fixedCents: 300,
    });
  });

  it("summarizeForecast: soma dos grupos = outflow", () => {
    const s = summarizeForecast([
      out_("commission", 1000),
      out_("package_cost", 4000),
      out_("fixed_expense", 250),
    ]);
    expect(
      s.professionalOutflowCents +
        s.operationalOutflowCents +
        s.fixedOutflowCents,
    ).toBe(s.outflowCents);
    expect(s).toMatchObject({
      professionalOutflowCents: 1000,
      operationalOutflowCents: 4000,
      fixedOutflowCents: 250,
    });
  });

  it("buckets repartem os grupos por semana", () => {
    const b = buildWeeklyBuckets(
      [
        out_("commission", 100, "2027-03-02"),
        out_("package_cost", 400, "2027-03-09"),
        out_("fixed_expense", 50, "2027-03-09"),
      ],
      "2027-03-01",
      "2027-03-15",
    );
    expect(b[0]).toMatchObject({
      professionalOutflowCents: 100,
      operationalOutflowCents: 0,
      fixedOutflowCents: 0,
    });
    expect(b[1]).toMatchObject({
      professionalOutflowCents: 0,
      operationalOutflowCents: 400,
      fixedOutflowCents: 50,
    });
  });
});
