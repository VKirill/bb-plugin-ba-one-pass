// Deterministic calculators behind the `ba_calc` tool.
// Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0:
// - prioritize      ← skills/requirements_prioritize_mcp.py (_aggregate_moscow, _aggregate_wsjf,
//                     _aggregate_impact_effort, _aggregate_timebox, _detect_stakeholder_conflicts,
//                     _check_must_inflation, _find_dependency_violations)
// - risk_matrix     ← skills/risk_assessment_mcp.py (_zone_for_score, run_risk_matrix,
//                     generate_recommendation)
// - compare_options ← skills/value_recommend_mcp.py (_calc_value_score and its parts,
//                     the four recommendation types) and design_options_mcp.py (weighted criteria)
// - change_score    ← skills/requirements_assess_changes_mcp.py (run_cr_impact thresholds,
//                     score_cr formula and verdicts)
// - gap_summary     ← skills/future_state_mcp.py (run_gap_analysis)
import { z } from "zod";
import type { Item, Priority } from "../../shared/model";
import { attrNumber, attrString, isActive, itemIndex, shortTitle, type ProjectSnapshot } from "./snapshot";
import { traceImpactMany } from "./trace";

const level3 = z.enum(["high", "medium", "low"]);
const moscow = z.enum(["must", "should", "could", "wont"]);

const prioritizeSchema = z.object({
  method: z.literal("prioritize"),
  technique: z.enum(["moscow", "wsjf", "impact_effort", "time_boxing"]),
  /** One row per stakeholder × requirement. `stakeholder` is an ST id (influence read from attrs.influence) or a name. */
  scores: z
    .array(
      z.object({
        stakeholder: z.string().min(1),
        item: z.string().min(1),
        value: moscow.optional(),
        bv: z.number().min(0).max(100).optional(),
        tc: z.number().min(0).max(100).optional(),
        rr: z.number().min(0).max(100).optional(),
        js: z.number().positive().max(100).optional(),
        impact: level3.optional(),
        effort: level3.optional(),
        cost: z.number().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(2000),
  /** time_boxing: the box size in the same unit as `cost`. */
  capacity: z.number().positive().optional(),
  /** impact_effort: quadrant → priority, merged over the default QuickWins=must, BigBets=should, FillIns=could, ThanklessTasks=wont. */
  quadrant_mapping: z
    .object({ quick_wins: moscow, big_bets: moscow, fill_ins: moscow, thankless_tasks: moscow })
    .partial()
    .optional(),
  /** Category spread that counts as a stakeholder conflict: 1 strict, 2 normal (default), 3 loose. */
  conflict_threshold: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

const riskMatrixSchema = z.object({
  method: z.literal("risk_matrix"),
  /** Risk ids; default all open/accepted risks. Each risk needs attrs.probability and attrs.impact (1–5). */
  ids: z.array(z.string()).optional(),
  /** Score (probability × impact) at or above which a risk is High. Default 15. */
  max_acceptable_score: z.number().int().min(1).max(25).optional(),
  tolerance: z.enum(["risk_averse", "neutral", "risk_seeking"]).optional(),
  /** Categories that are always High unless their response is avoid. */
  mandatory_avoid_categories: z.array(z.string()).optional(),
  /** The analyst's judgement on value vs cumulative risk; "risk_exceeds_value" → seek_higher_value. */
  value_vs_risk: z.enum(["value_exceeds_risk", "comparable", "risk_exceeds_value"]).optional(),
});

const compareOptionsSchema = z.object({
  method: z.literal("compare_options"),
  /** Option ids; default all active options. */
  ids: z.array(z.string()).optional(),
  /** Weighted criteria; scores come from option attrs.scores[criterion id] (1–5). Omit to use the value formula. */
  criteria: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().optional(),
        weight: z.union([z.number().positive(), level3]),
      }),
    )
    .optional(),
  /** Relative margin under which the top two are "too close" → recommend_parallel. Default 0.1. */
  parallel_margin: z.number().min(0).max(1).optional(),
  /** Best score below this → recommend_reanalyze. Default 3 (criteria, 1–5 scale) or 2 (value formula). */
  min_score: z.number().optional(),
});

const changeScoreSchema = z.object({
  method: z.literal("change_score"),
  /** The change request (CR-n). */
  id: z.string().min(1),
  benefit: level3,
  cost: level3,
  urgency: z.enum(["critical", "high", "normal"]).optional(),
  phase: z.enum(["development", "pre_release", "post_release"]).optional(),
  /** Items the change touches; default the CR's outgoing `impacts` links. */
  targets: z.array(z.string()).optional(),
  regulatory: z.boolean().optional(),
});

const gapSummarySchema = z.object({ method: z.literal("gap_summary") });

export const calcInputSchema = z.discriminatedUnion("method", [
  prioritizeSchema,
  riskMatrixSchema,
  compareOptionsSchema,
  changeScoreSchema,
  gapSummarySchema,
]);
export type CalcInput = z.infer<typeof calcInputSchema>;

const { method: _p, ...prioritizeFields } = prioritizeSchema.shape;
const { method: _r, ...riskFields } = riskMatrixSchema.shape;
const { method: _c, ...optionFields } = compareOptionsSchema.shape;
const { method: _s, ...changeFields } = changeScoreSchema.shape;

/**
 * The schema the agent sees: one flat object with typed fields. A top-level
 * union becomes `anyOf`, which agent clients flatten into untyped input, so
 * the model sent numbers and arrays as strings. The tool checks the input
 * against calcInputSchema (the per-method union) itself.
 */
export const calcToolSchema = z.object({
  method: z.enum(["prioritize", "risk_matrix", "compare_options", "change_score", "gap_summary"]),
  ...z.object(prioritizeFields).partial().shape,
  ...z.object(riskFields).partial().shape,
  ...z.object(optionFields).partial().shape,
  ...z.object(changeFields).partial().shape,
});

export interface CalcResult {
  markdown: string;
  data: unknown;
  updates: { id: string; priority?: Priority; attrs?: Record<string, unknown> }[];
}

// ── prioritize ───────────────────────────────────────────────────────────

const MOSCOW_WEIGHT: Record<Priority, number> = { must: 4, should: 3, could: 2, wont: 1 };
const MOSCOW_THRESHOLDS: [Priority, number][] = [
  ["must", 3.5],
  ["should", 2.5],
  ["could", 1.5],
  ["wont", 0],
];
const INFLUENCE_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const LEVEL: Record<string, number> = { high: 3, medium: 2, low: 1 };
const MUST_INFLATION = 0.6;

type Score = z.infer<typeof prioritizeSchema>["scores"][number];

function influenceOf(s: ProjectSnapshot, stakeholder: string): number {
  const item = s.items.find((candidate) => candidate.id === stakeholder && candidate.type === "stakeholder");
  const influence = item ? attrString(item, "influence").toLowerCase() : "";
  return INFLUENCE_WEIGHT[influence] ?? 2;
}

function byItem(scores: Score[]): Map<string, Score[]> {
  const grouped = new Map<string, Score[]>();
  for (const score of scores) grouped.set(score.item, [...(grouped.get(score.item) ?? []), score]);
  return grouped;
}

function moscowFromAverage(avg: number): Priority {
  for (const [label, threshold] of MOSCOW_THRESHOLDS) if (avg >= threshold) return label;
  return "wont";
}

function aggregateMoscow(s: ProjectSnapshot, scores: Score[]): Map<string, { priority: Priority; weighted: number }> {
  const result = new Map<string, { priority: Priority; weighted: number }>();
  for (const [item, rows] of byItem(scores.filter((row) => row.value !== undefined))) {
    let sum = 0;
    let weight = 0;
    for (const row of rows) {
      const w = influenceOf(s, row.stakeholder);
      sum += MOSCOW_WEIGHT[row.value as Priority] * w;
      weight += w;
    }
    const avg = weight === 0 ? 2 : sum / weight;
    result.set(item, { priority: moscowFromAverage(avg), weighted: round(avg) });
  }
  return result;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

interface PrioRow {
  id: string;
  priority: Priority | null;
  score: number | null;
  detail: string;
  attrs: Record<string, unknown>;
}

function prioritize(s: ProjectSnapshot, input: z.infer<typeof prioritizeSchema>): CalcResult {
  const index = itemIndex(s);
  const rows: PrioRow[] = [];
  const warnings: string[] = [];

  if (input.technique === "moscow") {
    for (const [id, agg] of aggregateMoscow(s, input.scores)) {
      rows.push({ id, priority: agg.priority, score: agg.weighted, detail: `weighted ${agg.weighted}`, attrs: { priority_score: agg.weighted } });
    }
  } else if (input.technique === "wsjf") {
    const raw: { id: string; wsjf: number; cod: number; js: number }[] = [];
    for (const [id, items] of byItem(input.scores)) {
      let bv = 0;
      let tc = 0;
      let rr = 0;
      let js = 0;
      let weight = 0;
      for (const row of items) {
        const w = influenceOf(s, row.stakeholder);
        bv += (row.bv ?? 0) * w;
        tc += (row.tc ?? 0) * w;
        rr += (row.rr ?? 0) * w;
        // Job size is an estimate, not an opinion: not weighted by influence.
        js += row.js ?? 1;
        weight += w;
      }
      if (weight === 0) continue;
      const cod = (bv + tc + rr) / weight;
      const size = js / items.length;
      raw.push({ id, wsjf: size > 0 ? round(cod / size) : 0, cod: round(cod), js: round(size) });
    }
    const max = Math.max(0, ...raw.map((row) => row.wsjf));
    for (const row of raw) {
      const ratio = max > 0 ? row.wsjf / max : 0;
      const priority: Priority = ratio >= 0.7 ? "must" : ratio >= 0.4 ? "should" : ratio >= 0.2 ? "could" : "wont";
      rows.push({
        id: row.id,
        priority,
        score: row.wsjf,
        detail: `WSJF ${row.wsjf} = CoD ${row.cod} / JS ${row.js}`,
        attrs: { priority_score: row.wsjf, wsjf: row.wsjf, cost_of_delay: row.cod, job_size: row.js },
      });
    }
  } else if (input.technique === "impact_effort") {
    const mapping = {
      quick_wins: "must",
      big_bets: "should",
      fill_ins: "could",
      thankless_tasks: "wont",
      ...input.quadrant_mapping,
    } as Record<string, Priority>;
    for (const [id, items] of byItem(input.scores)) {
      let impact = 0;
      let effort = 0;
      let weight = 0;
      for (const row of items) {
        const w = influenceOf(s, row.stakeholder);
        impact += (LEVEL[row.impact ?? "medium"] ?? 2) * w;
        effort += (LEVEL[row.effort ?? "medium"] ?? 2) * w;
        weight += w;
      }
      if (weight === 0) continue;
      const avgImpact = impact / weight;
      const avgEffort = effort / weight;
      const quadrant =
        avgImpact >= 2.5 && avgEffort < 2.5
          ? "quick_wins"
          : avgImpact >= 2.5
            ? "big_bets"
            : avgEffort < 2.5
              ? "fill_ins"
              : "thankless_tasks";
      const priority = mapping[quadrant] ?? "could";
      rows.push({
        id,
        priority,
        score: round(avgImpact - avgEffort),
        detail: `${quadrant} (impact ${round(avgImpact)}, effort ${round(avgEffort)})`,
        attrs: { quadrant, avg_impact: round(avgImpact), avg_effort: round(avgEffort) },
      });
    }
  } else {
    // time_boxing: fill a box of fixed capacity, value first, then cheapest.
    if (input.capacity === undefined) {
      return { markdown: "time_boxing needs `capacity`.", data: null, updates: [] };
    }
    const capacity = input.capacity;
    const backlog = s.items.filter((item) => item.type === "requirement" && isActive(item)).map((item) => item.id);
    const ids = new Set([...backlog, ...input.scores.map((row) => row.item)]);
    const sessionValues = aggregateMoscow(s, input.scores);
    const grouped = byItem(input.scores);
    const entries = [...ids].map((id) => {
      const costs = (grouped.get(id) ?? []).map((row) => row.cost).filter((cost): cost is number => cost !== undefined);
      const cost = costs.length > 0 ? round(costs.reduce((a, b) => a + b, 0) / costs.length) : null;
      const spread = costs.length > 0 ? round(Math.max(...costs) - Math.min(...costs)) : 0;
      const stored = index.get(id)?.priority ?? null;
      const value: Priority = sessionValues.get(id)?.priority ?? (stored === "wont" ? "could" : stored) ?? "could";
      const source = sessionValues.has(id) ? "session" : stored && stored !== "wont" ? "register" : "default";
      return { id, cost, spread, value, source, offBacklog: !backlog.includes(id) };
    });
    for (const entry of entries.filter((e) => e.offBacklog)) warnings.push(`${entry.id} is not an active requirement — not placed.`);
    const excluded = entries.filter((e) => !e.offBacklog && e.value === "wont" && e.source === "session");
    for (const entry of excluded) {
      rows.push({ id: entry.id, priority: "wont", score: null, detail: "excluded by decision (Won't)", attrs: { in_box: false } });
    }
    const order = entries
      .filter((e) => e.cost !== null && !e.offBacklog && !excluded.includes(e))
      .sort((a, b) => MOSCOW_WEIGHT[b.value] - MOSCOW_WEIGHT[a.value] || (a.cost ?? 0) - (b.cost ?? 0) || a.id.localeCompare(b.id));
    let cumulative = 0;
    for (const entry of order) {
      const cost = entry.cost ?? 0;
      const running = round(cumulative + cost);
      if (running <= capacity) {
        cumulative = running;
        rows.push({
          id: entry.id,
          priority: entry.value,
          score: cost,
          detail: `in box, cumulative ${cumulative}/${capacity}`,
          attrs: { in_box: true, cost, cumulative, value_source: entry.source },
        });
      } else {
        rows.push({
          id: entry.id,
          priority: "wont",
          score: cost,
          detail: `cut: cost ${cost} > remaining ${round(capacity - cumulative)}`,
          attrs: { in_box: false, cost, value_source: entry.source },
        });
      }
      if (entry.spread > 0) warnings.push(`${entry.id}: cost estimates differ by ${entry.spread}.`);
    }
    const unestimated = entries.filter((e) => e.cost === null && !e.offBacklog && !excluded.includes(e)).map((e) => e.id);
    if (unestimated.length > 0) warnings.push(`Not estimated, no priority written: ${unestimated.join(", ")}`);
  }

  // Stakeholder conflicts (MoSCoW / time boxing values only).
  const threshold = input.conflict_threshold ?? 2;
  const conflicts: { id: string; spread: number; votes: Record<string, string> }[] = [];
  if (input.technique === "moscow" || input.technique === "time_boxing") {
    for (const [id, items] of byItem(input.scores.filter((row) => row.value !== undefined))) {
      if (items.length < 2) continue;
      const values = items.map((row) => MOSCOW_WEIGHT[row.value as Priority]);
      const spread = Math.max(...values) - Math.min(...values);
      if (spread >= threshold) {
        conflicts.push({ id, spread, votes: Object.fromEntries(items.map((row) => [row.stakeholder, row.value as string])) });
      }
    }
  }

  // Dependency violations: a higher-priority item depends on a lower one.
  const priorityOf = new Map(rows.map((row) => [row.id, row.priority]));
  const violations: string[] = [];
  for (const link of s.links) {
    if (link.relation !== "depends_on") continue;
    const from = priorityOf.get(link.from) ?? index.get(link.from)?.priority ?? null;
    const to = priorityOf.get(link.to) ?? index.get(link.to)?.priority ?? null;
    if (from && to && MOSCOW_WEIGHT[from] > MOSCOW_WEIGHT[to]) {
      violations.push(`${link.from} (${from}) depends on ${link.to} (${to})`);
    }
  }

  const scored = rows.filter((row) => row.priority !== null);
  const mustRatio = scored.length === 0 ? 0 : scored.filter((row) => row.priority === "must").length / scored.length;
  const inflated = mustRatio > MUST_INFLATION;

  const lines = [
    `## Prioritisation — ${input.technique}`,
    "",
    "| Item | Priority | Score | Detail |",
    "| --- | --- | --- | --- |",
    ...rows
      .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
      .map((row) => `| ${row.id} ${shortTitle(index.get(row.id)?.title ?? "", 40)} | ${row.priority ?? "—"} | ${row.score ?? "—"} | ${row.detail} |`),
  ];
  if (conflicts.length > 0) {
    lines.push("", "### Stakeholder conflicts");
    for (const conflict of conflicts) {
      lines.push(`- ${conflict.id}: spread ${conflict.spread} — ${Object.entries(conflict.votes).map(([who, v]) => `${who}=${v}`).join(", ")}`);
    }
  }
  if (violations.length > 0) lines.push("", "### Dependency violations", ...violations.map((v) => `- ${v}`));
  if (inflated) lines.push("", `⚠️ Must inflation: ${Math.round(mustRatio * 100)}% Must (> ${MUST_INFLATION * 100}%). Re-check what is truly mandatory.`);
  if (warnings.length > 0) lines.push("", "### Notes", ...warnings.map((w) => `- ${w}`));

  return {
    markdown: lines.join("\n"),
    data: { technique: input.technique, rows, conflicts, violations, must_ratio: round(mustRatio), inflated },
    updates: rows
      .filter((row) => index.has(row.id))
      .map((row) => ({
        id: row.id,
        ...(row.priority === null ? {} : { priority: row.priority }),
        attrs: { ...row.attrs, priority_method: input.technique },
      })),
  };
}

// ── risk_matrix ──────────────────────────────────────────────────────────

type Zone = "low" | "medium" | "high";

function zoneFor(score: number, maxAcceptable: number): Zone {
  if (score >= maxAcceptable) return "high";
  if (score >= 6) return "medium";
  return "low";
}

function riskMatrix(s: ProjectSnapshot, input: z.infer<typeof riskMatrixSchema>): CalcResult {
  const maxAcceptable = input.max_acceptable_score ?? 15;
  const avoid = new Set((input.mandatory_avoid_categories ?? []).map((c) => c.toLowerCase()));
  const pool =
    input.ids !== undefined && input.ids.length > 0
      ? s.items.filter((item) => input.ids?.includes(item.id) && item.type === "risk")
      : s.items.filter((item) => item.type === "risk" && (item.status === "open" || item.status === "accepted"));
  const unscored = pool.filter((risk) => attrNumber(risk, "probability") === null || attrNumber(risk, "impact") === null);
  const scored = pool
    .filter((risk) => !unscored.includes(risk))
    .map((risk) => {
      const probability = Math.min(5, Math.max(1, attrNumber(risk, "probability") ?? 1));
      const impact = Math.min(5, Math.max(1, attrNumber(risk, "impact") ?? 1));
      const score = probability * impact;
      const category = attrString(risk, "category").toLowerCase();
      const response = attrString(risk, "response").toLowerCase();
      const forced = avoid.has(category) && response !== "avoid";
      const zone: Zone = forced ? "high" : zoneFor(score, maxAcceptable);
      return { risk, probability, impact, score, zone, forced, response };
    });
  if (scored.length === 0) {
    return {
      markdown:
        unscored.length > 0
          ? `No scored risks. Set attrs.probability and attrs.impact (1–5) on: ${unscored.map((r) => r.id).join(", ")}`
          : "The risk register is empty. Record risks first.",
      data: null,
      updates: [],
    };
  }
  const high = scored.filter((r) => r.zone === "high");
  const medium = scored.filter((r) => r.zone === "medium");
  const low = scored.filter((r) => r.zone === "low");
  const total = scored.reduce((sum, r) => sum + r.score, 0);
  const critical = high.filter((r) => r.impact === 5 && r.response === "accept" && attrString(r.risk, "mitigation") === "");
  const recommendation =
    critical.length > 0
      ? "do_not_proceed"
      : input.value_vs_risk === "risk_exceeds_value"
        ? "seek_higher_value"
        : high.length === 0
          ? "proceed_despite_risk"
          : "proceed_with_mitigation";
  const recommendationText: Record<string, string> = {
    do_not_proceed: `Do not proceed: critical risk(s) accepted without mitigation (${critical.map((r) => r.risk.id).join(", ")}).`,
    seek_higher_value: "Seek higher value: the analyst judges the risk exposure to exceed the expected value — revisit scope.",
    proceed_despite_risk: "Proceed: no risk is above the tolerance threshold.",
    proceed_with_mitigation: `Proceed with mitigation: ${high.length} high risk(s) need an active response plan.`,
  };
  const grid: string[] = ["| P \\ I | 1 | 2 | 3 | 4 | 5 |", "| --- | --- | --- | --- | --- | --- |"];
  for (let p = 5; p >= 1; p -= 1) {
    const cells = [1, 2, 3, 4, 5].map((i) =>
      scored
        .filter((r) => r.probability === p && r.impact === i)
        .map((r) => r.risk.id)
        .join(", "),
    );
    grid.push(`| ${p} | ${cells.join(" | ")} |`);
  }
  const lines = [
    "## Risk matrix",
    "",
    `Threshold: score ≥ ${maxAcceptable} is High${input.tolerance ? ` (tolerance ${input.tolerance})` : ""}. ${scored.length} risk(s): 🔴 ${high.length} · 🟡 ${medium.length} · 🟢 ${low.length}; total ${total}, average ${round(total / scored.length, 1)}.`,
    "",
    ...grid,
    "",
    "| Risk | Score | Zone | Response |",
    "| --- | --- | --- | --- |",
    ...[...scored]
      .sort((a, b) => b.score - a.score)
      .map(
        (r) =>
          `| ${r.risk.id} ${shortTitle(r.risk.title, 50)} | ${r.score} (${r.probability}×${r.impact}) | ${r.zone}${r.forced ? " (mandatory avoid)" : ""} | ${r.response || "—"} |`,
      ),
    "",
    `**Recommendation:** ${recommendationText[recommendation]}`,
  ];
  if (unscored.length > 0) lines.push("", `Not scored: ${unscored.map((r) => r.id).join(", ")}`);
  return {
    markdown: lines.join("\n"),
    data: {
      recommendation,
      max_acceptable_score: maxAcceptable,
      profile: { total: scored.length, high: high.length, medium: medium.length, low: low.length, total_score: total },
      risks: scored.map((r) => ({ id: r.risk.id, score: r.score, zone: r.zone })),
    },
    updates: scored.map((r) => ({ id: r.risk.id, attrs: { score: r.score, zone: r.zone } })),
  };
}

// ── compare_options ──────────────────────────────────────────────────────

const MAGNITUDE: Record<string, number> = { low: 1, medium: 2, high: 3 };
const CONFIDENCE: Record<string, number> = { low: 0.5, medium: 1, high: 1.5 };
const RISK_LEVEL: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function lower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function valueScore(s: ProjectSnapshot, option: Item): { score: number; breakdown: Record<string, number> } {
  const benefits = Array.isArray(option.attrs.benefits) ? (option.attrs.benefits as Record<string, unknown>[]) : [];
  const benefitScore =
    benefits.length === 0
      ? 0
      : round(
          benefits.reduce((sum, b) => sum + (MAGNITUDE[lower(b.magnitude)] ?? 1) * (CONFIDENCE[lower(b.confidence)] ?? 1), 0) /
            benefits.length,
          3,
        );
  const costItems = Array.isArray(option.attrs.cost_items) ? (option.attrs.cost_items as Record<string, unknown>[]) : [];
  const costScore =
    costItems.length > 0
      ? round(costItems.reduce((sum, c) => sum + (MAGNITUDE[lower(c.magnitude)] ?? 2), 0) / costItems.length, 3)
      : MAGNITUDE[lower(option.attrs.cost)] ?? 0;
  const goals = s.items.filter((item) => item.type === "goal" && isActive(item));
  const supported = goals.filter((goal) =>
    s.links.some((link) => link.from === option.id && link.to === goal.id && ["satisfies", "addresses"].includes(link.relation)),
  );
  const alignment =
    typeof option.attrs.alignment === "number" ? option.attrs.alignment : goals.length === 0 ? 0 : round(supported.length / goals.length, 3);
  const index = itemIndex(s);
  const linkedRisks = s.links
    .filter((link) => (link.from === option.id || link.to === option.id) && link.relation !== "mitigates")
    .map((link) => index.get(link.from === option.id ? link.to : link.from))
    .filter((item): item is Item => item?.type === "risk");
  const riskLevels = [
    RISK_LEVEL[lower(option.attrs.risk_level)] ?? 0,
    ...linkedRisks.map((risk) => {
      const zone = attrString(risk, "zone").toLowerCase();
      const score = (attrNumber(risk, "probability") ?? 0) * (attrNumber(risk, "impact") ?? 0);
      if (score >= 20) return 3;
      if (zone === "high" || score >= 15) return 2;
      if (zone === "medium" || score >= 6) return 1;
      return 0;
    }),
  ];
  const riskPenalty = Math.max(...riskLevels);
  const score = round(benefitScore * 2 + alignment * 1.5 - costScore * 1.5 - riskPenalty);
  return { score, breakdown: { benefits: benefitScore, alignment, cost: costScore, risk: riskPenalty } };
}

function compareOptions(s: ProjectSnapshot, input: z.infer<typeof compareOptionsSchema>): CalcResult {
  const options =
    input.ids !== undefined && input.ids.length > 0
      ? s.items.filter((item) => input.ids?.includes(item.id) && item.type === "option")
      : s.items.filter((item) => item.type === "option" && isActive(item));
  if (options.length === 0) {
    return {
      markdown: "## Option comparison\n\nNo options to compare. **Recommendation: no_action** — record design options first.",
      data: { recommendation: "no_action", ranking: [] },
      updates: [],
    };
  }
  const useCriteria = input.criteria !== undefined && input.criteria.length > 0;
  const missing: string[] = [];
  const ranking = options.map((option) => {
    if (useCriteria) {
      const scores = (option.attrs.scores ?? {}) as Record<string, unknown>;
      let sum = 0;
      let weights = 0;
      const breakdown: Record<string, number> = {};
      for (const criterion of input.criteria ?? []) {
        const weight = typeof criterion.weight === "number" ? criterion.weight : LEVEL[criterion.weight] ?? 2;
        const raw = scores[criterion.id];
        const value = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(value)) {
          missing.push(`${option.id}.${criterion.id}`);
          continue;
        }
        breakdown[criterion.id] = value;
        sum += value * weight;
        weights += weight;
      }
      return { option, score: weights === 0 ? 0 : round(sum / weights), breakdown };
    }
    const value = valueScore(s, option);
    return { option, score: value.score, breakdown: value.breakdown };
  });
  ranking.sort((a, b) => b.score - a.score || a.option.id.localeCompare(b.option.id));
  const minScore = input.min_score ?? (useCriteria ? 3 : 2);
  const margin = input.parallel_margin ?? 0.1;
  const best = ranking[0];
  const second = ranking[1];
  let recommendation: "recommend_option" | "recommend_parallel" | "recommend_reanalyze" | "no_action";
  if (best === undefined || (!useCriteria && best.score <= 0)) recommendation = "no_action";
  else if (best.score < minScore) recommendation = "recommend_reanalyze";
  else if (second !== undefined && best.score > 0 && (best.score - second.score) / best.score <= margin) recommendation = "recommend_parallel";
  else recommendation = "recommend_option";
  const chosen =
    recommendation === "recommend_option"
      ? [best?.option.id ?? ""]
      : recommendation === "recommend_parallel"
        ? [best?.option.id ?? "", second?.option.id ?? ""]
        : [];
  const explanation: Record<typeof recommendation, string> = {
    recommend_option: `Recommend ${chosen[0]}: it leads by more than ${Math.round(margin * 100)}%.`,
    recommend_parallel: `Top options ${chosen.join(" and ")} are within ${Math.round(margin * 100)}% — consider a pilot of one alongside the other, or a tie-breaking criterion.`,
    recommend_reanalyze: `The best score ${best?.score} is below ${minScore} — no option is good enough; revisit scope, requirements or options.`,
    no_action: "No option delivers positive value — recommend no action (keep the current state) or new options.",
  };
  const keys = [...new Set(ranking.flatMap((row) => Object.keys(row.breakdown)))];
  const lines = [
    "## Option comparison",
    "",
    useCriteria
      ? `Weighted criteria: ${(input.criteria ?? []).map((c) => `${c.label ?? c.id} (${c.weight})`).join(", ")}.`
      : "Value score = Benefits×2.0 + Alignment×1.5 − Cost×1.5 − Risk×1.0.",
    "",
    `| Rank | Option | Score | ${keys.join(" | ")} |`,
    `| --- | --- | --- | ${keys.map(() => "---").join(" | ")} |`,
    ...ranking.map(
      (row, i) => `| ${i + 1} | ${row.option.id} ${shortTitle(row.option.title, 40)} | ${row.score} | ${keys.map((k) => row.breakdown[k] ?? "—").join(" | ")} |`,
    ),
    "",
    `**Recommendation: ${recommendation}** — ${explanation[recommendation]}`,
  ];
  if (missing.length > 0) lines.push("", `Missing scores (attrs.scores): ${missing.join(", ")}`);
  return {
    markdown: lines.join("\n"),
    data: { recommendation, chosen, ranking: ranking.map((row, i) => ({ id: row.option.id, rank: i + 1, score: row.score, breakdown: row.breakdown })) },
    updates: ranking.map((row, i) => ({
      id: row.option.id,
      attrs: { score: row.score, rank: i + 1, recommended: chosen.includes(row.option.id) },
    })),
  };
}

// ── change_score ─────────────────────────────────────────────────────────

const CR_THRESHOLDS = { approve: 8, modify: 4, defer: 1 };

function changeScore(s: ProjectSnapshot, input: z.infer<typeof changeScoreSchema>): CalcResult {
  const index = itemIndex(s);
  const change = index.get(input.id);
  if (change === undefined || change.type !== "change") {
    return { markdown: `${input.id} is not a change request.`, data: null, updates: [] };
  }
  const targets =
    input.targets ?? s.links.filter((link) => link.from === change.id && link.relation === "impacts").map((link) => link.to);
  const impact = targets.length === 0 ? { ids: [] as string[], markdown: "" } : traceImpactMany(s, targets, 3);
  const affected = impact.ids.filter((id) => id !== change.id && !targets.includes(id));
  const total = affected.length + targets.length;
  const impactLevel = total >= 8 ? 3 : total >= 3 ? 2 : 1;
  const phase = input.phase ?? "development";
  const scheduleLevel = phase === "pre_release" || phase === "post_release" || total >= 8 ? 3 : total >= 3 ? 2 : 1;
  const benefit = LEVEL[input.benefit] ?? 2;
  const cost = LEVEL[input.cost] ?? 2;
  const urgency = { critical: 3, high: 2, normal: 1 }[input.urgency ?? "normal"];
  const score = round(benefit * 2 + urgency * 1.5 + impactLevel * 1 - cost * 1.5 - scheduleLevel * 1, 1);
  const regulatory = input.regulatory ?? change.attrs.regulatory === true;
  let verdict: "approve" | "modify" | "defer" | "reject" =
    score >= CR_THRESHOLDS.approve ? "approve" : score >= CR_THRESHOLDS.modify ? "modify" : score >= CR_THRESHOLDS.defer ? "defer" : "reject";
  if (regulatory && verdict === "reject") verdict = "defer";

  const levelName = (n: number) => (n === 3 ? "high" : n === 2 ? "medium" : "low");
  const checks: string[] = [];
  const targetItems = targets.map((id) => index.get(id)).filter((item): item is Item => item !== undefined);
  const noBusinessTrace = targetItems
    .filter((item) => item.type === "requirement" && item.kind !== "business")
    .filter(
      (item) =>
        !s.links.some(
          (link) =>
            link.from === item.id &&
            ["derives_from", "satisfies", "refines", "addresses"].includes(link.relation) &&
            ["goal", "need"].includes(index.get(link.to)?.type ?? "") ||
            (link.from === item.id && index.get(link.to)?.kind === "business"),
        ),
    )
    .map((item) => item.id);
  if (noBusinessTrace.length > 0) checks.push(`No trace to a business requirement, goal or need: ${noBusinessTrace.join(", ")} — clarify the business rationale.`);
  const wont = targetItems.filter((item) => item.priority === "wont").map((item) => item.id);
  if (wont.length > 0) checks.push(`Touches Won't-priority items: ${wont.join(", ")} — revisit prioritisation.`);
  const unknown = targets.filter((id) => !index.has(id));
  if (unknown.length > 0) checks.push(`Unknown targets: ${unknown.join(", ")}`);
  if (targets.length === 0) checks.push("No targets: link the CR with `impacts` to what it changes, or pass `targets`.");

  const verdictText: Record<typeof verdict, string> = {
    approve: "Approve — high value at an acceptable cost and manageable impact.",
    modify: "Modify — potential, but rebalance value and cost; consider narrowing scope or splitting the CR.",
    defer: regulatory && score < CR_THRESHOLDS.defer ? "Defer — rejection is not allowed for a regulatory change." : "Defer — not justified for this iteration; revisit with a refined rationale.",
    reject: "Reject — the cost clearly exceeds the expected value; record the rationale.",
  };
  const lines = [
    `## Change assessment — ${change.id} ${shortTitle(change.title, 60)}`,
    "",
    "Score = Benefit×2 + Urgency×1.5 + Impact×1 − Cost×1.5 − ScheduleRisk×1",
    "",
    "| Axis | Level | Value |",
    "| --- | --- | --- |",
    `| Benefit | ${input.benefit} | ${benefit} |`,
    `| Urgency | ${input.urgency ?? "normal"} | ${urgency} |`,
    `| Impact (auto, ${total} items) | ${levelName(impactLevel)} | ${impactLevel} |`,
    `| Cost | ${input.cost} | ${cost} |`,
    `| Schedule risk (auto, ${phase}) | ${levelName(scheduleLevel)} | ${scheduleLevel} |`,
    "",
    `**Score ${score} → ${verdict}.** ${verdictText[verdict]}`,
  ];
  if (affected.length > 0) lines.push("", `Affected beyond the targets: ${affected.join(", ")}`);
  if (checks.length > 0) lines.push("", "### Checks", ...checks.map((c) => `- ${c}`));
  const assessment = {
    score,
    verdict,
    benefit: input.benefit,
    cost: input.cost,
    urgency: input.urgency ?? "normal",
    impact: levelName(impactLevel),
    schedule_risk: levelName(scheduleLevel),
    targets,
    affected,
  };
  return { markdown: lines.join("\n"), data: assessment, updates: [{ id: change.id, attrs: { assessment } }] };
}

// ── gap_summary ──────────────────────────────────────────────────────────

function gapSummary(s: ProjectSnapshot): CalcResult {
  const states = s.items.filter((item) => item.type === "state" && isActive(item));
  const current = states.filter((item) => attrString(item, "side") === "current");
  const future = states.filter((item) => attrString(item, "side") === "future");
  const gaps = s.items.filter((item) => item.type === "gap");
  const needs = s.items.filter((item) => item.type === "need" && isActive(item));
  const goals = s.items.filter((item) => item.type === "goal" && isActive(item));
  const addressedBy = (id: string) =>
    s.links
      .filter((link) => link.to === id && ["addresses", "satisfies", "derives_from"].includes(link.relation))
      .map((link) => link.from);
  const categories = [...new Set(states.map((item) => attrString(item, "category") || "other"))].sort();
  const lines = [
    "## Gap summary",
    "",
    "| Category | Current | Future |",
    "| --- | --- | --- |",
    ...categories.map((category) => {
      const inCat = (list: Item[]) => list.filter((item) => (attrString(item, "category") || "other") === category).map((item) => item.id).join(", ") || "—";
      return `| ${category} | ${inCat(current)} | ${inCat(future)} |`;
    }),
    "",
    `Gaps: ${gaps.length} (${gaps.filter((g) => g.status === "open").length} open).`,
    ...gaps.map((gap) => `- ${gap.id} [${gap.status}] ${shortTitle(gap.title)} — addressed by: ${addressedBy(gap.id).join(", ") || "nothing yet"}`),
  ];
  const futureWithoutGap = future.filter(
    (state) => !s.links.some((link) => (link.from === state.id || link.to === state.id) && gaps.some((g) => g.id === (link.from === state.id ? link.to : link.from))),
  );
  if (current.length > 0 && future.length > 0 && gaps.length === 0) lines.push("", "⚠️ Current and future states exist but no gaps are recorded.");
  const needsUncovered = needs.filter((need) => addressedBy(need.id).length === 0).map((need) => need.id);
  const goalsWithoutKpi = goals.filter((goal) => attrString(goal, "kpi") === "" || attrString(goal, "target") === "").map((goal) => goal.id);
  if (needsUncovered.length > 0) lines.push("", `Needs not addressed by any requirement/option: ${needsUncovered.join(", ")}`);
  if (goalsWithoutKpi.length > 0) lines.push("", `Goals without KPI/target: ${goalsWithoutKpi.join(", ")}`);
  if (futureWithoutGap.length > 0 && gaps.length > 0) lines.push("", `Future-state elements not linked to a gap: ${futureWithoutGap.map((f) => f.id).join(", ")}`);
  return {
    markdown: lines.join("\n"),
    data: {
      current: current.map((item) => item.id),
      future: future.map((item) => item.id),
      gaps: gaps.map((gap) => ({ id: gap.id, status: gap.status, addressed_by: addressedBy(gap.id) })),
      needs_uncovered: needsUncovered,
      goals_without_kpi: goalsWithoutKpi,
    },
    updates: [],
  };
}

export function runCalc(s: ProjectSnapshot, input: CalcInput): CalcResult {
  switch (input.method) {
    case "prioritize":
      return prioritize(s, input);
    case "risk_matrix":
      return riskMatrix(s, input);
    case "compare_options":
      return compareOptions(s, input);
    case "change_score":
      return changeScore(s, input);
    case "gap_summary":
      return gapSummary(s);
  }
}
