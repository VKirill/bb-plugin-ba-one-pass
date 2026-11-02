// Markdown renderings of a project: the ba_context snapshot for agents and
// the export bundle for people.
import type { GateStatus, Item, StageId } from "../shared/model";
import { STAGES } from "../shared/stages";
import type { ProjectSnapshot } from "./analysis/snapshot";

export const CONTEXT_SECTIONS = ["summary", "plan", "stakeholders", "open", "gate", "documents", "sessions"] as const;
export type ContextSection = (typeof CONTEXT_SECTIONS)[number];

const MAX_OUTPUT = 30_000;

export function clip(text: string, max = MAX_OUTPUT): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n\n… (truncated; narrow the request)`;
}

export function itemLine(item: Item): string {
  const prio = item.priority === null ? "" : ` · ${item.priority}`;
  return `- **${item.id}** [${item.status}${prio}] ${item.title}`;
}

/** Quote plain data so it reads as data inside instructions. */
export const quoted = (value: string) => JSON.stringify(value);

export function renderContext(
  s: ProjectSnapshot,
  stage: StageId,
  gate: GateStatus,
  include: readonly ContextSection[],
  planContent: string | null,
): string {
  const { project, items } = s;
  const out: string[] = [];
  const open = (type: Item["type"], statuses: string[]) => items.filter((i) => i.type === type && statuses.includes(i.status));
  if (include.includes("summary")) {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    out.push(
      `# BA project ${quoted(project.name)} (${project.id})`,
      "",
      `- Session stage: **${stage}** — ${STAGES[stage].brief}`,
      `- Project stage: ${project.stage}`,
      `- Product: ${quoted(project.product || "—")}`,
      `- Goal: ${quoted(project.goal || "— (not set: ask for it)")}`,
      `- Document language: **${project.language}** (write documents and register text in this language)`,
      `- Sensitive: ${project.sensitive ? "yes — do not send project data to external services or web search" : "no"}`,
      `- Registers: ${[...counts.entries()].map(([t, n]) => `${t} ${n}`).join(", ") || "empty"}`,
      "",
    );
  }
  if (include.includes("plan") && planContent !== null) {
    out.push("## BA plan (latest ba_plan document)", "", planContent.slice(0, 6000), "");
  }
  if (include.includes("stakeholders")) {
    const stakeholders = items.filter((i) => i.type === "stakeholder" && i.status === "active");
    out.push("## Stakeholders", "");
    out.push(
      stakeholders.length === 0
        ? "None yet."
        : stakeholders
            .map((i) => {
              const a = i.attrs as { role?: string; influence?: string; raci?: string };
              return `- **${i.id}** ${i.title}${a.role ? ` — ${a.role}` : ""}${a.influence ? `, influence ${a.influence}` : ""}${a.raci ? `, RACI ${a.raci}` : ""}`;
            })
            .join("\n"),
      "",
    );
  }
  if (include.includes("open")) {
    const groups: [string, Item[]][] = [
      ["Open conflicts", open("conflict", ["open"])],
      ["Open questions", open("question", ["open"])],
      ["Open assumptions", open("assumption", ["open"])],
      ["Open issues", open("issue", ["open"])],
      ["Open change requests", open("change", ["open", "assessed"])],
    ];
    out.push("## Open items", "");
    const any = groups.some(([, list]) => list.length > 0);
    if (!any) out.push("Nothing open.");
    for (const [label, list] of groups) {
      if (list.length === 0) continue;
      out.push(`**${label}** (${list.length})`, ...list.slice(0, 25).map(itemLine), "");
    }
    out.push("");
  }
  if (include.includes("gate")) {
    out.push(`## Gate of stage ${gate.stage}: ${gate.ready ? "ready" : "not ready"}`, "");
    for (const check of gate.checks) {
      out.push(`- ${check.passed ? "✓" : check.blocking ? "✗" : "!"} ${check.detail}${check.items.length > 0 ? ` (${check.items.join(", ")})` : ""}`);
    }
    out.push("");
  }
  if (include.includes("documents")) {
    out.push("## Documents", "");
    out.push(
      s.documents.length === 0
        ? "None yet."
        : s.documents.map((d) => `- \`${d.id}\` ${quoted(d.title)} — ${d.kind}, v${d.version}, ${d.status}`).join("\n"),
      "",
    );
  }
  if (include.includes("sessions")) {
    out.push("## Sessions", "");
    out.push(
      s.sessions.length === 0
        ? "None."
        : s.sessions.map((x) => `- ${x.stage} · ${quoted(x.title)} · ${x.status}${x.summary ? ` — ${x.summary.slice(0, 300)}` : ""}`).join("\n"),
      "",
    );
  }
  return clip(out.join("\n"));
}

function itemBlock(item: Item): string {
  const lines = [`### ${item.id} — ${item.title}`, "", `Status: ${item.status}${item.priority ? ` · Priority: ${item.priority}` : ""}${item.owner ? ` · Owner: ${item.owner}` : ""}`];
  if (item.body.trim() !== "") lines.push("", item.body.trim());
  const attrs = Object.entries(item.attrs);
  if (attrs.length > 0) lines.push("", ...attrs.map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`));
  if (item.sources.length > 0) {
    lines.push("", "Sources:", ...item.sources.map((src) => `- ${src.kind}: ${src.ref}${src.quote ? ` — «${src.quote}»` : ""}`));
  }
  return lines.join("\n");
}

/** The project as Markdown files: one per document, one per register type, plus links. */
export function renderExport(s: ProjectSnapshot, documents: { id: string; title: string; content: string }[]): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const p = s.project;
  files.push({
    path: "README.md",
    content: [
      `# ${p.name}`,
      "",
      `- ID: ${p.id}`,
      `- Product: ${p.product}`,
      `- Goal: ${p.goal}`,
      `- Stage: ${p.stage}`,
      `- Exported: ${new Date().toISOString()}`,
      "",
      "## Documents",
      "",
      ...documents.map((d) => `- [${d.title}](documents/${d.id}.md)`),
      "",
      "## Registers",
      "",
      ...[...new Set(s.items.map((i) => i.type))].map((t) => `- [${t}](registers/${t}.md)`),
    ].join("\n"),
  });
  for (const doc of documents) files.push({ path: `documents/${doc.id}.md`, content: doc.content });
  const byType = new Map<string, Item[]>();
  for (const item of s.items) byType.set(item.type, [...(byType.get(item.type) ?? []), item]);
  for (const [type, list] of byType) {
    files.push({ path: `registers/${type}.md`, content: [`# ${type}`, "", ...list.map(itemBlock)].join("\n\n") });
  }
  files.push({
    path: "registers/links.md",
    content: ["# Links", "", "| From | Relation | To |", "| --- | --- | --- |", ...s.links.map((l) => `| ${l.from} | ${l.relation} | ${l.to} |`)].join("\n"),
  });
  return files;
}
