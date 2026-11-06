import { adminPrisma } from "./setup";
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertContractRow,
  type Phase4World,
} from "./helpers/phase4-fixtures";
import { deletePhase4Rows } from "./helpers/phase4-cleanup";
import { deletePhase3Rows } from "./helpers/phase3-cleanup";
import { deletePhase5Rows } from "./helpers/phase5-cleanup";

const FROM = "2027-03-01";
const TO = "2027-03-31";

const QUERY = `query($from: String!, $to: String!) {
  cashForecast(from: $from, to: $to) {
    from to timezone inflowTotal outflowTotal balance overdueInflowTotal noRuleCount withoutProfessionalCount
    professionalOutflowTotal operationalOutflowTotal fixedOutflowTotal
    buckets { start end inflow outflow balance overdueInflow professionalOutflow operationalOutflow fixedOutflow }
    items { date kind direction amount label refId overdue noRule withoutProfessional costGroup }
  }
}`;

type Item = {
  date: string;
  kind: string;
  direction: string;
  amount: string;
  label: string;
  refId: string | null;
  overdue: boolean;
  noRule: boolean;
  withoutProfessional: boolean;
  costGroup: string | null;
};

describe("Phase 5 - previsão de caixa (cashForecast)", () => {
  let w: Phase4World;
  let orgFilter: string;

  beforeAll(async () => {
    w = await createPhase4World("p5fc");
    orgFilter = `SELECT id FROM organizations WHERE id = '${w.orgId}'`;
  }, 90_000);

  afterAll(async () => {
    await reset();
    await destroyPhase4World(w);
  });

  async function reset() {
    await deletePhase5Rows(orgFilter);
    await deletePhase4Rows(orgFilter);
    await deletePhase3Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM commission_rules WHERE organization_id = '${w.orgId}'`,
    );
  }

  beforeEach(reset);

  const forecast = async () => {
    const res = await gqlAs(w, w.tokens.admin)(QUERY, { from: FROM, to: TO });
    expect(res.errors).toBeUndefined();
    return res.data.cashForecast as {
      inflowTotal: string;
      outflowTotal: string;
      balance: string;
      overdueInflowTotal: string;
      noRuleCount: number;
      withoutProfessionalCount: number;
      professionalOutflowTotal: string;
      operationalOutflowTotal: string;
      fixedOutflowTotal: string;
      buckets: {
        start: string;
        end: string;
        overdueInflow: string;
        professionalOutflow: string;
        operationalOutflow: string;
        fixedOutflow: string;
      }[];
      items: Item[];
    };
  };

  async function appt(opts: {
    startsAt: string;
    pro?: string;
    serviceId?: string;
    status?: string;
    variantId?: string;
    deposit?: string;
    contractId?: string;
    clientId?: string;
    minutes?: number;
  }) {
    const start = new Date(opts.startsAt);
    return adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: opts.pro ?? w.members.proA,
        clientId: opts.clientId ?? w.clientId,
        serviceId: opts.serviceId ?? w.serviceId,
        startsAt: start,
        endsAt: new Date(start.getTime() + (opts.minutes ?? 30) * 60_000),
        status: opts.status ?? "scheduled",
        serviceVariantId: opts.variantId ?? null,
        depositAmount: opts.deposit ?? "0.00",
        contractId: opts.contractId ?? null,
      },
    });
  }

  async function comandaFor(
    appointmentId: string,
    itemTotal: string | null,
    status = "open",
  ) {
    const comanda = await adminPrisma.comanda.create({
      data: {
        organizationId: w.orgId,
        code: `P5-${Math.random().toString(36).slice(2, 8)}`,
        clientId: w.clientId,
        status,
      },
    });
    if (itemTotal != null) {
      await adminPrisma.comandaItem.create({
        data: {
          organizationId: w.orgId,
          comandaId: comanda.id,
          kind: "service",
          serviceId: w.serviceId,
          appointmentId,
          professionalId: w.members.proA,
          nameSnapshot: "x",
          quantity: 1,
          listUnitPrice: itemTotal,
          unitPrice: itemTotal,
          total: itemTotal,
        },
      });
    }
    return comanda;
  }

  const byKind = (items: Item[], kind: string) =>
    items.filter((i) => i.kind === kind);

  it("1. agendamento scheduled sem comanda: preço base menos o sinal", async () => {
    const a = await appt({
      startsAt: "2027-03-02T10:00:00-03:00",
      deposit: "30.00",
    });
    const f = await forecast();
    const it = byKind(f.items, "appointment").find((i) => i.refId === a.id);
    expect(it).toMatchObject({
      amount: "70.00",
      date: "2027-03-02",
      direction: "in",
    });
  });

  it("2. variante, comanda aberta com item e comanda sem item do agendamento", async () => {
    const a1 = await appt({
      startsAt: "2027-03-02T10:00:00-03:00",
      status: "confirmed",
      variantId: w.variantId,
    });
    const a2 = await appt({
      startsAt: "2027-03-03T10:00:00-03:00",
      status: "confirmed",
      variantId: w.variantId,
    });
    const a3 = await appt({
      startsAt: "2027-03-04T10:00:00-03:00",
      status: "confirmed",
      variantId: w.variantId,
    });
    await comandaFor(a2.id, "90.00");
    await comandaFor(a3.id, null);
    const f = await forecast();
    const amount = (id: string) =>
      byKind(f.items, "appointment").find((i) => i.refId === id)?.amount;
    expect(amount(a1.id)).toBe("120.00");
    expect(amount(a2.id)).toBe("90.00");
    expect(amount(a3.id)).toBe("120.00");
  });

  it("3. cancelled, no_show, completed e in_progress não entram", async () => {
    const ids: string[] = [];
    let h = 9;
    for (const status of ["cancelled", "no_show", "completed", "in_progress"]) {
      ids.push(
        (
          await appt({
            startsAt: `2027-03-05T${String(h++).padStart(2, "0")}:00:00-03:00`,
            status,
          })
        ).id,
      );
    }
    const f = await forecast();
    expect(f.items.filter((i) => i.refId && ids.includes(i.refId))).toEqual([]);
  });

  it("4. fuso da org: limites da janela", async () => {
    const inLast = await appt({ startsAt: "2027-03-30T22:30:00-03:00" });
    const outTo = await appt({
      startsAt: "2027-03-31T00:30:00-03:00",
      pro: w.members.proB,
    });
    const inFirst = await appt({ startsAt: "2027-03-01T00:10:00-03:00" });
    const f = await forecast();
    const apps = byKind(f.items, "appointment");
    expect(apps.find((i) => i.refId === inLast.id)?.date).toBe("2027-03-30");
    expect(apps.find((i) => i.refId === outTo.id)).toBeUndefined();
    expect(apps.find((i) => i.refId === inFirst.id)?.date).toBe("2027-03-01");
    expect(f.items.find((i) => i.refId === outTo.id)).toBeUndefined();
  });

  it("5. comissão: regra de serviço e sem regra", async () => {
    await adminPrisma.commissionRule.create({
      data: {
        organizationId: w.orgId,
        scopeType: "service",
        serviceId: w.serviceId,
        kind: "percentage",
        value: "10",
      },
    });
    const a = await appt({
      startsAt: "2027-03-02T10:00:00-03:00",
      variantId: w.variantId,
    });
    const b = await appt({
      startsAt: "2027-03-02T12:00:00-03:00",
      serviceId: w.serviceBId,
    });
    const f = await forecast();
    const commissions = byKind(f.items, "commission");
    expect(commissions.find((i) => i.refId === a.id)).toMatchObject({
      amount: "12.00",
      direction: "out",
      noRule: false,
    });
    expect(commissions.find((i) => i.refId === b.id)).toMatchObject({
      amount: "0.00",
      noRule: true,
    });
    expect(f.noRuleCount).toBeGreaterThanOrEqual(1);
  });

  describe("contratos", () => {
    async function makeContract(status: string, paid?: string) {
      const g = await insertBridalGroupRow(w, { eventDate: "2027-06-15" });
      const c = await insertContractRow(w, {
        groupId: g.groupId,
        brideClientId: g.brideClientId,
        totalAmount: "2000.00",
        depositAmount: "1000.00",
        status,
        balanceDueDate: "2027-03-20",
        installments: [
          { seq: 1, amount: "500.00", dueDate: "2027-02-20" },
          { seq: 2, amount: "500.00", dueDate: "2027-03-05" },
        ],
      });
      if (paid) {
        await adminPrisma.contractPayment.create({
          data: {
            organizationId: w.orgId,
            contractId: c.contractId,
            kind: "payment",
            method: "pix",
            amount: paid,
          },
        });
      }
      return c;
    }
    const mine = (items: Item[], id: string) =>
      items.filter((i) => i.refId === id);

    it("6. parcelas e restante; vencida entra em from em atraso", async () => {
      const c = await makeContract("active");
      const f = await forecast();
      const its = mine(f.items, c.contractId);
      const p1 = its.find(
        (i) =>
          i.kind === "contract_installment" && i.label.includes("parcela 1"),
      );
      const p2 = its.find(
        (i) =>
          i.kind === "contract_installment" && i.label.includes("parcela 2"),
      );
      const bal = its.find((i) => i.kind === "contract_balance");
      expect(p1).toMatchObject({
        date: "2027-03-01",
        overdue: true,
        amount: "500.00",
      });
      expect(p2).toMatchObject({
        date: "2027-03-05",
        overdue: false,
        amount: "500.00",
      });
      expect(bal).toMatchObject({ date: "2027-03-20", amount: "1000.00" });
      expect(f.overdueInflowTotal).toBe("500.00");
      expect(f.buckets[0].overdueInflow).toBe("500.00");
    });

    it("6b. pagamento de 600.00 abate parcela 1 e parte da 2", async () => {
      const c = await makeContract("active", "600.00");
      const f = await forecast();
      const its = mine(f.items, c.contractId).filter(
        (i) => i.kind === "contract_installment",
      );
      expect(its.find((i) => i.label.includes("parcela 1"))).toBeUndefined();
      expect(its.find((i) => i.label.includes("parcela 2"))?.amount).toBe(
        "400.00",
      );
    });

    it("6c. contrato draft e cancelled não geram itens", async () => {
      const d = await makeContract("draft");
      const x = await makeContract("cancelled");
      const f = await forecast();
      expect(
        f.items.filter(
          (i) => i.refId === d.contractId || i.refId === x.contractId,
        ),
      ).toEqual([]);
    });

    it("7. agendamento ligado a contrato: sem entrada, com comissão", async () => {
      const c = await makeContract("active");
      const a = await appt({
        startsAt: "2027-03-10T10:00:00-03:00",
        contractId: c.contractId,
      });
      const f = await forecast();
      expect(
        byKind(f.items, "appointment").find((i) => i.refId === a.id),
      ).toBeUndefined();
      expect(
        byKind(f.items, "commission").find((i) => i.refId === a.id),
      ).toBeDefined();
    });

    describe("8. item de contrato sem agendamento", () => {
      async function setup() {
        const g = await insertBridalGroupRow(w, { eventDate: "2027-03-15" });
        const c = await insertContractRow(w, {
          groupId: g.groupId,
          brideClientId: g.brideClientId,
          totalAmount: "50.00",
          depositAmount: "0.00",
          status: "active",
          balanceDueDate: "2027-04-20",
          items: [
            {
              groupMemberId: g.brideMemberId,
              serviceId: w.serviceBId,
              unitPrice: "50.00",
            },
          ],
        });
        return { ...c, brideClientId: g.brideClientId };
      }
      const est = (items: Item[], id: string) =>
        byKind(items, "commission").find(
          (i) => i.refId === id && i.withoutProfessional,
        );

      it("usa a maior regra aplicável, depois a default, e some com agendamento", async () => {
        const c = await setup();
        await adminPrisma.commissionRule.create({
          data: {
            organizationId: w.orgId,
            scopeType: "service",
            serviceId: w.serviceBId,
            kind: "percentage",
            value: "20",
          },
        });
        await adminPrisma.commissionRule.create({
          data: {
            organizationId: w.orgId,
            scopeType: "member_service",
            memberId: w.members.proB,
            serviceId: w.serviceBId,
            kind: "fixed",
            value: "15.00",
          },
        });
        let f = await forecast();
        let e = est(f.items, c.contractId);
        expect(e).toMatchObject({
          amount: "15.00",
          date: "2027-03-15",
          withoutProfessional: true,
        });
        expect(e?.label).toContain("sem profissional definido");
        expect(f.withoutProfessionalCount).toBe(1);

        await adminPrisma.commissionRule.create({
          data: {
            organizationId: w.orgId,
            scopeType: "default",
            kind: "percentage",
            value: "5",
          },
        });
        f = await forecast();
        expect(est(f.items, c.contractId)?.amount).toBe("2.50");

        await appt({
          startsAt: "2027-03-15T10:00:00-03:00",
          serviceId: w.serviceBId,
          contractId: c.contractId,
          clientId: c.brideClientId,
        });
        f = await forecast();
        expect(est(f.items, c.contractId)).toBeUndefined();
        expect(f.withoutProfessionalCount).toBe(0);
      });
    });
  });

  describe("outros custos do pacote (package_cost)", () => {
    async function pkgWithCosts(costs: [string, string][]) {
      const pkg = await adminPrisma.package.create({
        data: { organizationId: w.orgId, name: "Pacote P5", price: "1000.00" },
      });
      for (const [i, [name, cost]] of costs.entries()) {
        await adminPrisma.packageCostItem.create({
          data: {
            organizationId: w.orgId,
            packageId: pkg.id,
            name,
            cost,
            displayOrder: i,
          },
        });
      }
      return pkg;
    }
    async function pkgContract(
      status: string,
      eventDate: string,
      packageId: string | null,
    ) {
      const g = await insertBridalGroupRow(w, { eventDate });
      const c = await insertContractRow(w, {
        groupId: g.groupId,
        brideClientId: g.brideClientId,
        totalAmount: "1000.00",
        depositAmount: "0.00",
        status,
        balanceDueDate: "2027-06-01",
      });
      await adminPrisma.contract.update({
        where: { id: c.contractId },
        data: { packageId },
      });
      return c;
    }
    const pc = (items: Item[], id: string) =>
      byKind(items, "package_cost").filter((i) => i.refId === id);

    it("contrato ativo com evento na janela: um item por custo, na data do evento", async () => {
      const pkg = await pkgWithCosts([
        ["Lanche", "200.00"],
        ["Champagne", "40.00"],
        ["Assistente", "200.00"],
      ]);
      const c = await pkgContract("active", "2027-03-15", pkg.id);
      const f = await forecast();
      const its = pc(f.items, c.contractId);
      expect(its.map((i) => i.amount).sort()).toEqual([
        "200.00",
        "200.00",
        "40.00",
      ]);
      expect(
        its.every(
          (i) =>
            i.date === "2027-03-15" &&
            i.direction === "out" &&
            i.costGroup === "operational",
        ),
      ).toBe(true);
      expect(its.find((i) => i.label === `Lanche — ${c.code}`)).toBeDefined();
      expect(f.operationalOutflowTotal).toBe("440.00");
      expect(f.professionalOutflowTotal).toBe("0.00");
      expect(f.fixedOutflowTotal).toBe("0.00");
      expect(f.outflowTotal).toBe("440.00");
      expect(
        f.buckets.reduce((s, b) => s + Number(b.operationalOutflow), 0),
      ).toBe(440);
    });

    it("evento fora da janela, contrato draft/cancelled e sem pacote não geram itens", async () => {
      const pkg = await pkgWithCosts([["Lanche", "200.00"]]);
      const out = await pkgContract("active", "2027-04-15", pkg.id);
      const d = await pkgContract("draft", "2027-03-15", pkg.id);
      const x = await pkgContract("cancelled", "2027-03-15", pkg.id);
      const n = await pkgContract("active", "2027-03-15", null);
      const f = await forecast();
      for (const c of [out, d, x, n])
        expect(pc(f.items, c.contractId)).toEqual([]);
      expect(f.operationalOutflowTotal).toBe("0.00");
    });

    it("uma vez por contrato mesmo com várias integrantes; custo zero é ignorado; pacote excluído não conta", async () => {
      const pkg = await pkgWithCosts([
        ["Lanche", "200.00"],
        ["Brinde", "0.00"],
      ]);
      const g = await insertBridalGroupRow(w, { eventDate: "2027-03-20" });
      const c = await insertContractRow(w, {
        groupId: g.groupId,
        brideClientId: g.brideClientId,
        totalAmount: "100.00",
        depositAmount: "0.00",
        status: "active",
        balanceDueDate: "2027-06-01",
        items: [
          {
            groupMemberId: g.brideMemberId,
            serviceId: w.serviceBId,
            unitPrice: "50.00",
          },
          {
            groupMemberId: g.brideMemberId,
            serviceId: w.serviceId,
            unitPrice: "50.00",
          },
        ],
      });
      await adminPrisma.contract.update({
        where: { id: c.contractId },
        data: { packageId: pkg.id },
      });
      let f = await forecast();
      const its = pc(f.items, c.contractId);
      expect(its).toHaveLength(1);
      expect(its[0]).toMatchObject({ amount: "200.00", date: "2027-03-20" });

      await adminPrisma.package.update({
        where: { id: pkg.id },
        data: { deletedAt: new Date() },
      });
      f = await forecast();
      expect(pc(f.items, c.contractId)).toEqual([]);
    });

    it("totais por grupo: profissional + operacional + fixo = saídas", async () => {
      const pkg = await pkgWithCosts([["Lanche", "200.00"]]);
      await pkgContract("active", "2027-03-15", pkg.id);
      await adminPrisma.fixedExpense.create({
        data: {
          organizationId: w.orgId,
          name: "Aluguel P5",
          amount: "300.00",
          dueDay: 10,
          active: true,
        },
      });
      await appt({ startsAt: "2027-03-10T10:00:00-03:00" });
      await adminPrisma.commissionRule.create({
        data: {
          organizationId: w.orgId,
          scopeType: "default",
          kind: "fixed",
          value: "25.00",
        },
      });
      const f = await forecast();
      expect(f.operationalOutflowTotal).toBe("200.00");
      expect(f.fixedOutflowTotal).toBe("300.00");
      expect(f.professionalOutflowTotal).toBe("25.00");
      expect(f.outflowTotal).toBe("525.00");
      expect(byKind(f.items, "commission")[0].costGroup).toBe("professional");
      expect(byKind(f.items, "fixed_expense")[0].costGroup).toBe("fixed");
      const inflow = f.items.filter((i) => i.direction === "in");
      expect(inflow.length).toBeGreaterThan(0);
      expect(inflow.every((i) => i.costGroup === null)).toBe(true);
      const b = f.buckets.reduce(
        (s, x) =>
          s +
          Number(x.professionalOutflow) +
          Number(x.operationalOutflow) +
          Number(x.fixedOutflow),
        0,
      );
      expect(b).toBe(525);
    });
  });

  it("9. despesas fixas: ativa entra, inativa e dia 31 não", async () => {
    const mk = (name: string, dueDay: number, active: boolean) =>
      adminPrisma.fixedExpense.create({
        data: {
          organizationId: w.orgId,
          name,
          amount: "1500.00",
          dueDay,
          active,
        },
      });
    const on = await mk("Aluguel", 10, true);
    const off = await mk("Inativa", 12, false);
    const edge = await mk("Dia 31", 31, true);
    const f = await forecast();
    const fx = byKind(f.items, "fixed_expense");
    expect(fx.find((i) => i.refId === on.id)).toMatchObject({
      date: "2027-03-10",
      amount: "1500.00",
      direction: "out",
    });
    expect(fx.find((i) => i.refId === off.id)).toBeUndefined();
    expect(fx.find((i) => i.refId === edge.id)).toBeUndefined();
  });

  it("10. totais, saldo negativo e buckets semanais", async () => {
    await adminPrisma.fixedExpense.create({
      data: {
        organizationId: w.orgId,
        name: "Aluguel",
        amount: "250.00",
        dueDay: 10,
      },
    });
    await appt({ startsAt: "2027-03-02T10:00:00-03:00", deposit: "30.00" });
    const f = await forecast();
    const sum = (dir: string) =>
      f.items
        .filter((i) => i.direction === dir)
        .reduce((s, i) => s + Math.round(parseFloat(i.amount) * 100), 0);
    expect(f.inflowTotal).toBe((sum("in") / 100).toFixed(2));
    expect(f.outflowTotal).toBe((sum("out") / 100).toFixed(2));
    expect(f.balance).toBe(((sum("in") - sum("out")) / 100).toFixed(2));
    expect(f.buckets).toHaveLength(5);
    expect(f.buckets[4].start).toBe("2027-03-29");
    expect(f.buckets[4].end).toBe("2027-03-31");

    await adminPrisma.fixedExpense.create({
      data: {
        organizationId: w.orgId,
        name: "Energia",
        amount: "1000.00",
        dueDay: 15,
      },
    });
    const g = await forecast();
    expect(g.balance.startsWith("-")).toBe(true);
  });

  it("11. datas inválidas", async () => {
    const res = await gqlAs(w, w.tokens.admin)(QUERY, {
      from: "2027-3-1",
      to: "2027-03-31",
    });
    expect(res.errors?.[0].message).toBe(
      "Datas devem estar no formato AAAA-MM-DD.",
    );
  });
});
