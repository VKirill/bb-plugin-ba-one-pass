// Small builder for in-memory project snapshots used by the analysis tests.
import type { DocumentKind, Item, ItemType, LinkRelation, RequirementKind } from "../../src/shared/model";
import type { ProjectSnapshot } from "../../src/server/analysis";

const NOW = "2026-11-02T00:00:00.000Z";

export function snapshot(language = "en"): ProjectSnapshot {
  return {
    project: {
      id: "demo",
      name: "Demo",
      goal: "",
      product: "",
      bbProjectId: "proj_1",
      language,
      sensitive: false,
      stage: "plan",
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
    items: [],
    links: [],
    documents: [],
    sessions: [],
  };
}

export function item(
  s: ProjectSnapshot,
  id: string,
  type: ItemType,
  fields: Partial<Omit<Item, "id" | "type">> & { kind?: RequirementKind | null } = {},
): Item {
  const created: Item = {
    id,
    projectId: s.project.id,
    type,
    kind: fields.kind ?? (type === "requirement" ? "functional" : null),
    title: fields.title ?? `${id} title`,
    body: fields.body ?? "",
    status: fields.status ?? (type === "question" || type === "conflict" || type === "risk" || type === "change" || type === "issue" || type === "gap" ? "open" : type === "stakeholder" ? "active" : "draft"),
    priority: fields.priority ?? null,
    owner: fields.owner ?? null,
    attrs: fields.attrs ?? {},
    sources: fields.sources ?? [],
    stage: fields.stage ?? null,
    sessionId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
  s.items.push(created);
  return created;
}

export function link(s: ProjectSnapshot, from: string, relation: LinkRelation, to: string): void {
  s.links.push({ from, to, relation, note: null, createdAt: NOW });
}

export function doc(s: ProjectSnapshot, kind: DocumentKind): void {
  s.documents.push({
    id: `DOC-${s.documents.length + 1}`,
    projectId: s.project.id,
    kind,
    title: kind,
    status: "draft",
    version: 1,
    stage: null,
    sessionId: null,
    updatedAt: NOW,
  });
}

export const SRC = [{ kind: "person" as const, ref: "ST-1", quote: "said so" }];
