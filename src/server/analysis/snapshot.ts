// In-memory view of one BA project. Every analysis function in this folder is
// pure over a snapshot: no SDK, no I/O.
import type { DocumentSummary, Item, Link, Project, Session } from "../../shared/model";

export interface ProjectSnapshot {
  project: Project;
  items: Item[];
  links: Link[];
  documents: DocumentSummary[];
  sessions: Session[];
}

const INACTIVE_STATUSES = new Set(["deprecated", "rejected", "superseded", "inactive"]);

/** Items that still count: not deprecated / rejected. */
export function isActive(item: Item): boolean {
  return !INACTIVE_STATUSES.has(item.status);
}

export function itemIndex(s: ProjectSnapshot): Map<string, Item> {
  return new Map(s.items.map((item) => [item.id, item]));
}

export function hasDocument(s: ProjectSnapshot, ...kinds: string[]): boolean {
  return s.documents.some((doc) => kinds.includes(doc.kind));
}

export function attrString(item: Item, key: string): string {
  const value = item.attrs[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

export function attrNumber(item: Item, key: string): number | null {
  const value = item.attrs[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function shortTitle(text: string, max = 70): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
