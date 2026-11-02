// Traceability graph: impact, coverage, matrix, orphans.
// Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0
// — skills/requirements_traceability_mcp.py (run_impact_analysis, check_coverage,
// export_traceability_matrix) and requirements_assess_changes_mcp.py (_bfs_impact).
import type { Item, ItemType, LinkRelation } from "../../shared/model";
import { isActive, itemIndex, shortTitle, type ProjectSnapshot } from "./snapshot";

/** Incoming links of these relations mean "the source depends on the target". */
const DEPENDENT_RELATIONS: ReadonlySet<LinkRelation> = new Set<LinkRelation>([
  "derives_from",
  "satisfies",
  "verifies",
  "refines",
  "depends_on",
  "mitigates",
  "addresses",
  "conflicts_with",
]);

/** Outgoing links of these relations propagate a change forward. */
const FORWARD_RELATIONS: ReadonlySet<LinkRelation> = new Set<LinkRelation>(["impacts", "conflicts_with"]);

interface ImpactHit {
  id: string;
  depth: number;
  via: string;
  relation: LinkRelation;
}

function impactHits(s: ProjectSnapshot, startIds: readonly string[], depth: number): ImpactHit[] {
  const seen = new Set(startIds);
  const hits: ImpactHit[] = [];
  let frontier = [...startIds];
  for (let level = 1; level <= depth && frontier.length > 0; level += 1) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const link of s.links) {
        let other: string | null = null;
        if (link.to === current && DEPENDENT_RELATIONS.has(link.relation)) other = link.from;
        else if (link.from === current && FORWARD_RELATIONS.has(link.relation)) other = link.to;
        if (other === null || seen.has(other)) continue;
        seen.add(other);
        hits.push({ id: other, depth: level, via: current, relation: link.relation });
        next.push(other);
      }
    }
    frontier = next;
  }
  return hits;
}

/** Everything that depends on `id` (directly or through up to `depth` hops). */
export function traceImpact(s: ProjectSnapshot, id: string, depth = 3): { markdown: string; ids: string[] } {
  return traceImpactMany(s, [id], depth);
}

/** Impact of several items at once (a change request touching many requirements). */
export function traceImpactMany(
  s: ProjectSnapshot,
  ids: readonly string[],
  depth = 3,
): { markdown: string; ids: string[] } {
  const index = itemIndex(s);
  const missing = ids.filter((id) => !index.has(id));
  const hits = impactHits(s, ids, Math.max(1, Math.min(depth, 10)));
  const lines: string[] = [`## Impact of ${ids.join(", ")}`, ""];
  if (missing.length > 0) lines.push(`Unknown ids: ${missing.join(", ")}`, "");
  if (hits.length === 0) {
    lines.push("Nothing in the register depends on it.");
  } else {
    lines.push(`${hits.length} affected item(s), depth ≤ ${depth}:`, "");
    lines.push("| Item | Type | Status | Depth | Via |", "| --- | --- | --- | --- | --- |");
    for (const hit of hits) {
      const item = index.get(hit.id);
      lines.push(
        `| ${hit.id} ${item ? shortTitle(item.title, 60) : ""} | ${item?.type ?? "?"} | ${item?.status ?? "?"} | ${hit.depth} | ${hit.relation} ${hit.via} |`,
      );
    }
  }
  return { markdown: lines.join("\n"), ids: hits.map((hit) => hit.id) };
}

function linked(s: ProjectSnapshot, from: string, to: string, relations?: ReadonlySet<LinkRelation>): boolean {
  return s.links.some(
    (link) => link.from === from && link.to === to && (relations === undefined || relations.has(link.relation)),
  );
}

function anyLink(s: ProjectSnapshot, a: string, b: string): boolean {
  return s.links.some((link) => (link.from === a && link.to === b) || (link.from === b && link.to === a));
}

const SATISFY_RELATIONS: ReadonlySet<LinkRelation> = new Set<LinkRelation>(["satisfies", "derives_from", "addresses", "refines"]);
const VERIFY: ReadonlySet<LinkRelation> = new Set<LinkRelation>(["verifies"]);

export function requirementsOf(s: ProjectSnapshot): Item[] {
  return s.items.filter((item) => item.type === "requirement" && isActive(item));
}

/** Active criteria that verify the item. */
export function criteriaOf(s: ProjectSnapshot, id: string): string[] {
  const index = itemIndex(s);
  return s.links
    .filter((link) => link.to === id && link.relation === "verifies")
    .map((link) => index.get(link.from))
    .filter((item): item is Item => item !== undefined && item.type === "criterion" && isActive(item))
    .map((item) => item.id);
}

export function traceCoverage(s: ProjectSnapshot): {
  markdown: string;
  uncovered: {
    goals: string[];
    requirementsWithoutCriteria: string[];
    mustWithoutScenario: string[];
    needsWithoutRequirements: string[];
  };
} {
  const requirements = requirementsOf(s);
  const scenarios = s.items.filter((item) => item.type === "scenario" && isActive(item));
  const goals = s.items.filter((item) => item.type === "goal" && isActive(item));
  const needs = s.items.filter((item) => item.type === "need" && isActive(item));

  const goalsUncovered = goals
    .filter((goal) => !requirements.some((req) => linked(s, req.id, goal.id, SATISFY_RELATIONS)))
    .map((goal) => goal.id);
  const needsUncovered = needs
    .filter((need) => !requirements.some((req) => linked(s, req.id, need.id, SATISFY_RELATIONS)))
    .map((need) => need.id);
  const withoutCriteria = requirements.filter((req) => criteriaOf(s, req.id).length === 0).map((req) => req.id);
  const mustWithoutScenario = requirements
    .filter((req) => req.priority === "must" && !scenarios.some((sc) => anyLink(s, sc.id, req.id)))
    .map((req) => req.id);

  const pct = (covered: number, total: number) => (total === 0 ? "—" : `${Math.round((covered / total) * 100)}%`);
  const lines = [
    "## Coverage",
    "",
    "| Check | Covered | Gaps |",
    "| --- | --- | --- |",
    `| Goals with a requirement | ${pct(goals.length - goalsUncovered.length, goals.length)} | ${goalsUncovered.join(", ") || "—"} |`,
    `| Needs with a requirement | ${pct(needs.length - needsUncovered.length, needs.length)} | ${needsUncovered.join(", ") || "—"} |`,
    `| Requirements with acceptance criteria | ${pct(requirements.length - withoutCriteria.length, requirements.length)} | ${withoutCriteria.join(", ") || "—"} |`,
    `| Must requirements with a scenario | ${pct(
      requirements.filter((r) => r.priority === "must").length - mustWithoutScenario.length,
      requirements.filter((r) => r.priority === "must").length,
    )} | ${mustWithoutScenario.join(", ") || "—"} |`,
  ];
  return {
    markdown: lines.join("\n"),
    uncovered: {
      goals: goalsUncovered,
      requirementsWithoutCriteria: withoutCriteria,
      mustWithoutScenario,
      needsWithoutRequirements: needsUncovered,
    },
  };
}

export function traceMatrix(
  s: ProjectSnapshot,
  from: ItemType[] = ["requirement"],
  to: ItemType[] = ["goal", "need", "criterion", "scenario"],
): {
  rows: { id: string; title: string; priority: string | null }[];
  columns: { id: string; title: string }[];
  cells: { row: string; column: string; relation: string }[];
} {
  const rowItems = s.items.filter((item) => from.includes(item.type) && isActive(item));
  const columnItems = s.items.filter((item) => to.includes(item.type) && isActive(item));
  const rowIds = new Set(rowItems.map((item) => item.id));
  const columnIds = new Set(columnItems.map((item) => item.id));
  const cells: { row: string; column: string; relation: string }[] = [];
  const seen = new Set<string>();
  const push = (row: string, column: string, relation: string) => {
    const key = `${row}|${column}|${relation}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ row, column, relation });
  };
  for (const link of s.links) {
    if (rowIds.has(link.from) && columnIds.has(link.to)) push(link.from, link.to, link.relation);
    else if (rowIds.has(link.to) && columnIds.has(link.from)) push(link.to, link.from, link.relation);
  }
  return {
    rows: rowItems.map((item) => ({ id: item.id, title: item.title, priority: item.priority })),
    columns: columnItems.map((item) => ({ id: item.id, title: item.title })),
    cells,
  };
}

/** Markdown rendering of a matrix (for the agent and exports). */
export function matrixMarkdown(matrix: ReturnType<typeof traceMatrix>): string {
  if (matrix.rows.length === 0 || matrix.columns.length === 0) return "_Empty matrix._";
  const header = `| | ${matrix.columns.map((column) => column.id).join(" | ")} |`;
  const divider = `| --- | ${matrix.columns.map(() => "---").join(" | ")} |`;
  const body = matrix.rows.map((row) => {
    const cells = matrix.columns.map((column) => {
      const hits = matrix.cells.filter((cell) => cell.row === row.id && cell.column === column.id);
      return hits.length === 0 ? "" : hits.map((cell) => cell.relation).join(", ");
    });
    return `| ${row.id}${row.priority ? ` (${row.priority})` : ""} | ${cells.join(" | ")} |`;
  });
  return [header, divider, ...body].join("\n");
}

const ORPHAN_EXEMPT: ReadonlySet<ItemType> = new Set<ItemType>(["stakeholder", "source", "decision", "term", "question"]);

/** Items with no links at all (stakeholders, sources, decisions, terms, questions exempt). */
export function traceOrphans(s: ProjectSnapshot): { markdown: string; ids: string[] } {
  const touched = new Set<string>();
  for (const link of s.links) {
    touched.add(link.from);
    touched.add(link.to);
  }
  const orphans = s.items.filter((item) => isActive(item) && !ORPHAN_EXEMPT.has(item.type) && !touched.has(item.id));
  const lines =
    orphans.length === 0
      ? ["## Orphans", "", "Every item is linked."]
      : [
          "## Orphans",
          "",
          `${orphans.length} item(s) without links:`,
          "",
          ...orphans.map((item) => `- ${item.id} (${item.type}) ${shortTitle(item.title)}`),
        ];
  return { markdown: lines.join("\n"), ids: orphans.map((item) => item.id) };
}
