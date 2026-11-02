import { describe, expect, it } from "vitest";
import {
  BLOCKING_CHARACTERISTICS,
  checkQuality,
  lintText,
  traceCoverage,
  traceImpact,
  traceMatrix,
  traceOrphans,
} from "../../src/server/analysis";
import { item, link, snapshot, SRC } from "./fixture";

function graph() {
  const s = snapshot();
  item(s, "G-1", "goal", { attrs: { kpi: "conversion", target: "5%" } });
  item(s, "G-2", "goal");
  item(s, "BN-1", "need", { sources: SRC });
  item(s, "BR-1", "requirement", { kind: "business", priority: "must", sources: SRC, body: "Customers see the order status." });
  item(s, "FR-1", "requirement", { priority: "must", sources: SRC, body: "The system shows the order status within 2 seconds." });
  item(s, "AC-1", "criterion", { attrs: { given: "an order", when: "opened", then: "status shown" } });
  item(s, "SC-1", "scenario");
  item(s, "R-9", "risk");
  link(s, "BR-1", "satisfies", "G-1");
  link(s, "FR-1", "derives_from", "BR-1");
  link(s, "AC-1", "verifies", "FR-1");
  link(s, "SC-1", "refines", "FR-1");
  return s;
}

describe("trace", () => {
  it("finds everything that depends on an item", () => {
    const result = traceImpact(graph(), "BR-1");
    expect(result.ids.sort()).toEqual(["AC-1", "FR-1", "SC-1"]);
    expect(result.markdown).toContain("FR-1");
  });

  it("respects depth", () => {
    expect(traceImpact(graph(), "BR-1", 1).ids).toEqual(["FR-1"]);
  });

  it("reports coverage gaps", () => {
    const { uncovered } = traceCoverage(graph());
    expect(uncovered.goals).toEqual(["G-2"]);
    expect(uncovered.needsWithoutRequirements).toEqual(["BN-1"]);
    expect(uncovered.requirementsWithoutCriteria).toEqual(["BR-1"]);
    expect(uncovered.mustWithoutScenario).toEqual(["BR-1"]);
  });

  it("builds a matrix and skips deprecated rows", () => {
    const s = graph();
    item(s, "FR-2", "requirement", { status: "deprecated" });
    const matrix = traceMatrix(s);
    expect(matrix.rows.map((row) => row.id)).toEqual(["BR-1", "FR-1"]);
    expect(matrix.cells).toContainEqual({ row: "BR-1", column: "G-1", relation: "satisfies" });
    expect(matrix.cells).toContainEqual({ row: "FR-1", column: "AC-1", relation: "verifies" });
  });

  it("lists orphans", () => {
    expect(traceOrphans(graph()).ids.sort()).toEqual(["BN-1", "G-2", "R-9"]);
  });
});

describe("lintText", () => {
  it("flags English vague and compound wording", () => {
    const warnings = lintText("The page loads fast and is user-friendly and also secure", "en");
    expect(warnings.some((w) => w.includes('"fast"'))).toBe(true);
    expect(warnings.some((w) => w.startsWith("Possibly compound"))).toBe(true);
  });

  it("flags Russian vague words and does not match inside other words", () => {
    expect(lintText("Система должна быстро загружать страницу", "ru")[0]).toContain('"быстро"');
    expect(lintText("Частота опроса — 5 минут", "ru")).toEqual([]);
  });

  it("flags implementation detail", () => {
    expect(lintText("Использовать REST API для отправки", "ru").some((w) => w.includes("implementation"))).toBe(true);
  });

  it("is quiet on a clean requirement", () => {
    expect(lintText("The system shows the order status within 2 seconds.", "en")).toEqual([]);
  });
});

describe("checkQuality", () => {
  it("scores a well-formed requirement high", () => {
    const s = graph();
    const result = checkQuality(s, { ids: ["FR-1"] }).results[0];
    expect(result?.scores.verifiable).toBe(3);
    expect(result?.scores.necessary).toBe(2);
    for (const c of BLOCKING_CHARACTERISTICS) expect(result?.scores[c]).toBeGreaterThanOrEqual(2);
  });

  it("fails a vague, compound, untraced requirement", () => {
    const s = snapshot("ru");
    item(s, "FR-7", "requirement", {
      title: "Быстро и удобно показывать заказы и отправлять уведомления",
      priority: "must",
    });
    const result = checkQuality(s).results[0];
    expect(result?.scores.unambiguous).toBe(0);
    expect(result?.scores.singular).toBe(0);
    expect(result?.scores.necessary).toBe(0);
    expect(result?.scores.verifiable).toBe(0);
    expect(result?.scores.traceable).toBe(0);
  });

  it("checks criteria for Given/When/Then and rules for conditions", () => {
    const s = snapshot();
    item(s, "AC-2", "criterion", { title: "Works" });
    item(s, "RULE-1", "rule", { title: "If the order is paid, it cannot be cancelled" });
    const results = checkQuality(s).results;
    expect(results.find((r) => r.id === "AC-2")?.scores.verifiable).toBe(0);
    expect(results.find((r) => r.id === "RULE-1")?.scores.verifiable).toBe(3);
  });

  it("reports set-level issues", () => {
    const s = snapshot();
    item(s, "FR-1", "requirement", { title: "Show status", priority: "must" });
    item(s, "FR-2", "requirement", { title: "Show status!", priority: "must" });
    item(s, "FR-3", "requirement", { title: "Export", priority: "must" });
    item(s, "FR-4", "requirement", { title: "Print" });
    const { setIssues, markdown } = checkQuality(s);
    expect(setIssues.some((i) => i.startsWith("Duplicate requirements: FR-1, FR-2"))).toBe(true);
    expect(setIssues.some((i) => i.startsWith("Must inflation"))).toBe(true);
    expect(setIssues.some((i) => i.includes("FR-4"))).toBe(true);
    expect(markdown).toContain("| FR-1 |");
  });
});
