import { describe, expect, it } from "vitest";
import { calcInputSchema, evaluateGate, runCalc } from "../../src/server/analysis";
import { doc, item, link, snapshot, SRC } from "./fixture";

describe("evaluateGate", () => {
  it("plan: fails without goal and stakeholders, passes when complete", () => {
    const s = snapshot();
    const failing = evaluateGate(s, "plan");
    expect(failing.ready).toBe(false);
    expect(failing.checks.find((c) => c.id === "plan.stakeholders")?.passed).toBe(false);
    expect(failing.checks[0]?.label).toBe("gate.plan.goal");

    s.project.goal = "Cut refund handling time";
    item(s, "ST-1", "stakeholder", { attrs: { role: "Sponsor" } });
    item(s, "ST-2", "stakeholder");
    item(s, "ST-3", "stakeholder");
    const passing = evaluateGate(s, "plan");
    expect(passing.ready).toBe(true);
    // The document check is advisory.
    expect(passing.checks.find((c) => c.id === "plan.document")).toMatchObject({ passed: false, blocking: false });
  });

  it("elicit: open conflicts and unsourced facts block", () => {
    const s = snapshot();
    item(s, "F-1", "fact");
    item(s, "CON-1", "conflict", { sources: SRC });
    const gate = evaluateGate(s, "elicit");
    expect(gate.ready).toBe(false);
    expect(gate.checks.find((c) => c.id === "elicit.sourced")?.items).toEqual(["F-1"]);
    expect(gate.checks.find((c) => c.id === "elicit.conflicts")?.items).toEqual(["CON-1"]);
  });

  it("strategy: goals need KPI and target", () => {
    const s = snapshot();
    item(s, "BN-1", "need", { sources: SRC });
    item(s, "G-1", "goal", { attrs: { kpi: "time" } });
    expect(evaluateGate(s, "strategy").ready).toBe(false);
    s.items[1]!.attrs.target = "2 days";
    expect(evaluateGate(s, "strategy").ready).toBe(true);
  });

  it("requirements and one-pass: must requirements need criteria and quality", () => {
    const s = snapshot();
    item(s, "G-1", "goal", { attrs: { kpi: "k", target: "t" } });
    item(s, "FR-1", "requirement", {
      priority: "must",
      sources: SRC,
      owner: "ST-1",
      body: "The system shows the order status within 2 seconds.",
    });
    link(s, "FR-1", "satisfies", "G-1");
    const before = evaluateGate(s, "requirements");
    expect(before.ready).toBe(false);
    expect(before.checks.find((c) => c.id === "requirements.criteria")?.items).toEqual(["FR-1"]);

    item(s, "AC-1", "criterion", { attrs: { given: "g", when: "w", then: "t" } });
    link(s, "AC-1", "verifies", "FR-1");
    expect(evaluateGate(s, "requirements").ready).toBe(true);

    expect(evaluateGate(s, "one-pass").ready).toBe(false);
    doc(s, "brpv");
    expect(evaluateGate(s, "one-pass").ready).toBe(true);
  });

  it("lifecycle: an unassessed open change blocks", () => {
    const s = snapshot();
    item(s, "CR-1", "change");
    expect(evaluateGate(s, "lifecycle").ready).toBe(false);
    s.items[0]!.attrs.assessment = { verdict: "approve" };
    expect(evaluateGate(s, "lifecycle").ready).toBe(true);
  });
});

describe("runCalc", () => {
  it("prioritize moscow weights votes by influence and detects conflicts", () => {
    const s = snapshot();
    item(s, "ST-1", "stakeholder", { attrs: { influence: "high" } });
    item(s, "ST-2", "stakeholder", { attrs: { influence: "low" } });
    item(s, "FR-1", "requirement");
    item(s, "FR-2", "requirement");
    const input = calcInputSchema.parse({
      method: "prioritize",
      technique: "moscow",
      scores: [
        { stakeholder: "ST-1", item: "FR-1", value: "must" },
        { stakeholder: "ST-2", item: "FR-1", value: "could" },
        { stakeholder: "ST-1", item: "FR-2", value: "could" },
      ],
    });
    const result = runCalc(s, input);
    // FR-1: (4*3 + 2*1) / 4 = 3.5 → must
    expect(result.updates.find((u) => u.id === "FR-1")?.priority).toBe("must");
    expect(result.updates.find((u) => u.id === "FR-2")?.priority).toBe("could");
    expect((result.data as { conflicts: { id: string }[] }).conflicts.map((c) => c.id)).toEqual(["FR-1"]);
  });

  it("prioritize wsjf normalises to MoSCoW labels", () => {
    const s = snapshot();
    const result = runCalc(
      s,
      calcInputSchema.parse({
        method: "prioritize",
        technique: "wsjf",
        scores: [
          { stakeholder: "a", item: "FR-1", bv: 8, tc: 5, rr: 3, js: 2 },
          { stakeholder: "a", item: "FR-2", bv: 2, tc: 1, rr: 1, js: 8 },
        ],
      }),
    );
    const rows = (result.data as { rows: { id: string; priority: string; score: number }[] }).rows;
    expect(rows.find((r) => r.id === "FR-1")).toMatchObject({ priority: "must", score: 8 });
    expect(rows.find((r) => r.id === "FR-2")).toMatchObject({ priority: "wont", score: 0.5 });
  });

  it("prioritize time_boxing fills the box value-first and cuts the rest", () => {
    const s = snapshot();
    item(s, "FR-1", "requirement");
    item(s, "FR-2", "requirement");
    item(s, "FR-3", "requirement");
    const result = runCalc(
      s,
      calcInputSchema.parse({
        method: "prioritize",
        technique: "time_boxing",
        capacity: 5,
        scores: [
          { stakeholder: "a", item: "FR-1", value: "must", cost: 3 },
          { stakeholder: "a", item: "FR-2", value: "should", cost: 3 },
          { stakeholder: "a", item: "FR-3", value: "could", cost: 2 },
        ],
      }),
    );
    const byId = Object.fromEntries(result.updates.map((u) => [u.id, u]));
    expect(byId["FR-1"]?.priority).toBe("must");
    expect(byId["FR-2"]?.priority).toBe("wont");
    expect(byId["FR-3"]?.priority).toBe("could");
  });

  it("prioritize impact_effort maps quadrants", () => {
    const s = snapshot();
    const result = runCalc(
      s,
      calcInputSchema.parse({
        method: "prioritize",
        technique: "impact_effort",
        scores: [{ stakeholder: "a", item: "FR-1", impact: "high", effort: "low" }],
      }),
    );
    expect(result.updates[0]).toBeUndefined(); // FR-1 is not in the register: no update
    expect((result.data as { rows: { priority: string }[] }).rows[0]?.priority).toBe("must");
  });

  it("risk_matrix classifies zones and recommends", () => {
    const s = snapshot();
    item(s, "R-1", "risk", { attrs: { probability: 4, impact: 4, response: "mitigate" } });
    item(s, "R-2", "risk", { attrs: { probability: 1, impact: 2 } });
    item(s, "R-3", "risk", { attrs: { probability: 2, impact: 2, category: "regulatory" } });
    item(s, "R-4", "risk");
    const result = runCalc(s, calcInputSchema.parse({ method: "risk_matrix", mandatory_avoid_categories: ["regulatory"] }));
    const zones = Object.fromEntries(result.updates.map((u) => [u.id, u.attrs?.zone]));
    expect(zones).toEqual({ "R-1": "high", "R-2": "low", "R-3": "high" });
    expect((result.data as { recommendation: string }).recommendation).toBe("proceed_with_mitigation");
    expect(result.markdown).toContain("Not scored: R-4");
  });

  it("risk_matrix: a critical accepted risk without mitigation stops the change", () => {
    const s = snapshot();
    item(s, "R-1", "risk", { attrs: { probability: 4, impact: 5, response: "accept" } });
    const data = runCalc(s, calcInputSchema.parse({ method: "risk_matrix" })).data as { recommendation: string };
    expect(data.recommendation).toBe("do_not_proceed");
  });

  it("compare_options with criteria: leader, parallel and reanalyze", () => {
    const s = snapshot();
    item(s, "OPT-1", "option", { status: "proposed", attrs: { scores: { cost: 4, fit: 5 } } });
    item(s, "OPT-2", "option", { status: "proposed", attrs: { scores: { cost: 2, fit: 3 } } });
    const criteria = [
      { id: "cost", weight: "high" },
      { id: "fit", weight: 1 },
    ];
    const leader = runCalc(s, calcInputSchema.parse({ method: "compare_options", criteria }));
    expect(leader.data).toMatchObject({ recommendation: "recommend_option", chosen: ["OPT-1"] });

    s.items[1]!.attrs.scores = { cost: 4, fit: 4.5 };
    const close = runCalc(s, calcInputSchema.parse({ method: "compare_options", criteria }));
    expect((close.data as { recommendation: string }).recommendation).toBe("recommend_parallel");

    const low = runCalc(s, calcInputSchema.parse({ method: "compare_options", criteria, min_score: 10 }));
    expect((low.data as { recommendation: string }).recommendation).toBe("recommend_reanalyze");
  });

  it("compare_options value formula and no_action", () => {
    const s = snapshot();
    expect((runCalc(s, calcInputSchema.parse({ method: "compare_options" })).data as { recommendation: string }).recommendation).toBe(
      "no_action",
    );
    item(s, "OPT-1", "option", {
      status: "proposed",
      attrs: { benefits: [{ magnitude: "high", confidence: "high" }], cost: "low", alignment: 1 },
    });
    const result = runCalc(s, calcInputSchema.parse({ method: "compare_options" }));
    // 4.5*2 + 1*1.5 - 1*1.5 - 0 = 9
    expect((result.data as { ranking: { score: number }[] }).ranking[0]?.score).toBe(9);
  });

  it("change_score computes the CR formula and stores the assessment", () => {
    const s = snapshot();
    item(s, "CR-1", "change");
    item(s, "FR-1", "requirement", { priority: "wont" });
    item(s, "AC-1", "criterion");
    link(s, "CR-1", "impacts", "FR-1");
    link(s, "AC-1", "verifies", "FR-1");
    const result = runCalc(s, calcInputSchema.parse({ method: "change_score", id: "CR-1", benefit: "high", cost: "low" }));
    // total 2 → impact low(1), schedule low(1): 3*2 + 1*1.5 + 1 - 1*1.5 - 1 = 6
    expect(result.data).toMatchObject({ score: 6, verdict: "modify", affected: ["AC-1"] });
    expect(result.updates[0]?.id).toBe("CR-1");
    expect(result.markdown).toContain("Won't-priority");
  });

  it("change_score: a regulatory change is never rejected", () => {
    const s = snapshot();
    item(s, "CR-1", "change");
    const data = runCalc(
      s,
      calcInputSchema.parse({ method: "change_score", id: "CR-1", benefit: "low", cost: "high", phase: "pre_release", regulatory: true }),
    ).data as { verdict: string };
    expect(data.verdict).toBe("defer");
  });

  it("gap_summary lists states, gaps and uncovered needs", () => {
    const s = snapshot();
    item(s, "SE-1", "state", { attrs: { side: "current", category: "process" } });
    item(s, "SE-2", "state", { attrs: { side: "future", category: "process" } });
    item(s, "GAP-1", "gap");
    item(s, "BN-1", "need", { sources: SRC });
    const result = runCalc(s, calcInputSchema.parse({ method: "gap_summary" }));
    expect(result.data).toMatchObject({ current: ["SE-1"], future: ["SE-2"], needs_uncovered: ["BN-1"] });
    expect(result.markdown).toContain("| process | SE-1 | SE-2 |");
  });

  it("rejects unknown methods at the schema", () => {
    expect(calcInputSchema.safeParse({ method: "nope" }).success).toBe(false);
  });
});
