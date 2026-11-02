// Plugin SQLite store: projects, register items (+ history), links,
// documents (+ versions), sessions. Synchronous better-sqlite3; every
// multi-row write runs in one transaction.
import type Database from "better-sqlite3";
import {
  ID_PREFIX,
  ITEM_STATUSES,
  PROJECT_ID_PATTERN,
  SOURCE_REQUIRED,
  type BaDocument,
  type DocumentKind,
  type DocumentStatus,
  type DocumentSummary,
  type Item,
  type ItemSource,
  type ItemType,
  type Link,
  type LinkRelation,
  type Priority,
  type Project,
  type RequirementKind,
  type Session,
  type StageId,
} from "../shared/model";
import type { ProjectSnapshot } from "./analysis/snapshot";

export const MIGRATIONS: string[] = [
  `CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT NOT NULL DEFAULT '',
    product TEXT NOT NULL DEFAULT '',
    bb_project_id TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'ru',
    sensitive INTEGER NOT NULL DEFAULT 0,
    stage TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE items (
    project_id TEXT NOT NULL,
    id TEXT NOT NULL,
    type TEXT NOT NULL,
    kind TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    priority TEXT,
    owner TEXT,
    attrs TEXT NOT NULL DEFAULT '{}',
    sources TEXT NOT NULL DEFAULT '[]',
    stage TEXT,
    session_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, id)
  );
  CREATE INDEX items_type ON items (project_id, type);
  CREATE TABLE item_history (
    project_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    session_id TEXT,
    note TEXT,
    PRIMARY KEY (project_id, item_id, version)
  );
  CREATE TABLE links (
    project_id TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (project_id, from_id, to_id, relation)
  );
  CREATE TABLE documents (
    project_id TEXT NOT NULL,
    id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    version INTEGER NOT NULL,
    stage TEXT,
    session_id TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, id)
  );
  CREATE TABLE document_versions (
    project_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    session_id TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (project_id, document_id, version)
  );
  CREATE TABLE sessions (
    thread_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT,
    created_at TEXT NOT NULL,
    closed_at TEXT
  );
  CREATE INDEX sessions_project ON sessions (project_id);
  CREATE TABLE counters (
    project_id TEXT NOT NULL,
    prefix TEXT NOT NULL,
    next INTEGER NOT NULL,
    PRIMARY KEY (project_id, prefix)
  );`,
];

export class StoreError extends Error {}

const now = () => new Date().toISOString();

export function slugify(name: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  const latin = [...name.toLowerCase()].map((ch) => map[ch] ?? ch).join("");
  const slug = latin.replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 48);
  return slug === "" ? "project" : slug;
}

export function idPrefix(type: ItemType, kind: RequirementKind | null): string {
  if (type === "requirement") {
    if (kind === null) throw new StoreError("A requirement needs a kind: business, stakeholder, functional, nonfunctional or transition.");
    return ID_PREFIX.requirement[kind];
  }
  return ID_PREFIX[type];
}

interface ProjectRow {
  id: string; name: string; goal: string; product: string; bb_project_id: string; language: string;
  sensitive: number; stage: string; archived: number; created_at: string; updated_at: string;
}
interface ItemRow {
  project_id: string; id: string; type: string; kind: string | null; title: string; body: string;
  status: string; priority: string | null; owner: string | null; attrs: string; sources: string;
  stage: string | null; session_id: string | null; version: number; created_at: string; updated_at: string;
}
interface LinkRow { from_id: string; to_id: string; relation: string; note: string | null; created_at: string }
interface DocumentRow {
  project_id: string; id: string; kind: string; title: string; status: string; version: number;
  stage: string | null; session_id: string | null; updated_at: string;
}
interface SessionRow {
  thread_id: string; project_id: string; stage: string; title: string; status: string;
  summary: string | null; created_at: string; closed_at: string | null;
}

const toProject = (r: ProjectRow): Project => ({
  id: r.id, name: r.name, goal: r.goal, product: r.product, bbProjectId: r.bb_project_id,
  language: r.language, sensitive: r.sensitive === 1, stage: r.stage as StageId,
  archived: r.archived === 1, createdAt: r.created_at, updatedAt: r.updated_at,
});
const toItem = (r: ItemRow): Item => ({
  id: r.id, projectId: r.project_id, type: r.type as ItemType, kind: r.kind as RequirementKind | null,
  title: r.title, body: r.body, status: r.status, priority: r.priority as Priority | null, owner: r.owner,
  attrs: JSON.parse(r.attrs) as Record<string, unknown>, sources: JSON.parse(r.sources) as ItemSource[],
  stage: r.stage as StageId | null, sessionId: r.session_id, version: r.version,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const toLink = (r: LinkRow): Link => ({
  from: r.from_id, to: r.to_id, relation: r.relation as LinkRelation, note: r.note, createdAt: r.created_at,
});
const toDocSummary = (r: DocumentRow): DocumentSummary => ({
  id: r.id, projectId: r.project_id, kind: r.kind as DocumentKind, title: r.title,
  status: r.status as DocumentStatus, version: r.version, stage: r.stage as StageId | null,
  sessionId: r.session_id, updatedAt: r.updated_at,
});
const toSession = (r: SessionRow): Session => ({
  threadId: r.thread_id, projectId: r.project_id, stage: r.stage as StageId, title: r.title,
  status: r.status as Session["status"], summary: r.summary, createdAt: r.created_at, closedAt: r.closed_at,
});

export interface ItemInput {
  id?: string;
  type: ItemType;
  kind?: RequirementKind | null;
  title?: string;
  body?: string;
  status?: string;
  priority?: Priority | null;
  owner?: string | null;
  attrs?: Record<string, unknown>;
  sources?: ItemSource[];
  links?: { to: string; relation: LinkRelation; note?: string }[];
}

export interface WriteContext {
  stage: StageId | null;
  sessionId: string | null;
  note?: string | null;
}

export class Store {
  constructor(private readonly db: Database.Database) {}

  // ── Projects ──────────────────────────────────────────────────────────

  listProjects(includeArchived = false): Project[] {
    const rows = this.db
      .prepare(`SELECT * FROM projects ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY updated_at DESC`)
      .all() as ProjectRow[];
    return rows.map(toProject);
  }

  getProject(id: string): Project {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
    if (row === undefined) throw new StoreError(`No BA project "${id}".`);
    return toProject(row);
  }

  createProject(input: {
    id?: string; name: string; goal: string; product: string; bbProjectId: string;
    language: string; sensitive: boolean; stage: StageId;
  }): Project {
    let id = input.id ?? slugify(input.name);
    if (!PROJECT_ID_PATTERN.test(id)) throw new StoreError(`Invalid project id "${id}".`);
    if (input.id === undefined) {
      const base = id;
      for (let n = 2; this.db.prepare("SELECT 1 FROM projects WHERE id = ?").get(id) !== undefined; n++) {
        id = `${base}-${n}`;
      }
    } else if (this.db.prepare("SELECT 1 FROM projects WHERE id = ?").get(id) !== undefined) {
      throw new StoreError(`A BA project "${id}" already exists.`);
    }
    const at = now();
    this.db
      .prepare(
        `INSERT INTO projects (id, name, goal, product, bb_project_id, language, sensitive, stage, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(id, input.name, input.goal, input.product, input.bbProjectId, input.language, input.sensitive ? 1 : 0, input.stage, at, at);
    return this.getProject(id);
  }

  updateProject(id: string, patch: Partial<Pick<Project, "name" | "goal" | "product" | "bbProjectId" | "language" | "sensitive" | "archived" | "stage">>): Project {
    const current = this.getProject(id);
    const next = { ...current, ...patch };
    this.db
      .prepare(
        `UPDATE projects SET name = ?, goal = ?, product = ?, bb_project_id = ?, language = ?, sensitive = ?, archived = ?, stage = ?, updated_at = ? WHERE id = ?`,
      )
      .run(next.name, next.goal, next.product, next.bbProjectId, next.language, next.sensitive ? 1 : 0, next.archived ? 1 : 0, next.stage, now(), id);
    return this.getProject(id);
  }

  private touch(projectId: string): void {
    this.db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now(), projectId);
  }

  // ── Items ─────────────────────────────────────────────────────────────

  private nextId(projectId: string, prefix: string): string {
    const row = this.db.prepare("SELECT next FROM counters WHERE project_id = ? AND prefix = ?").get(projectId, prefix) as
      | { next: number }
      | undefined;
    const n = row?.next ?? 1;
    this.db
      .prepare("INSERT INTO counters (project_id, prefix, next) VALUES (?, ?, ?) ON CONFLICT (project_id, prefix) DO UPDATE SET next = excluded.next")
      .run(projectId, prefix, n + 1);
    return `${prefix}-${n}`;
  }

  getItem(projectId: string, id: string): Item | null {
    const row = this.db.prepare("SELECT * FROM items WHERE project_id = ? AND id = ?").get(projectId, id) as ItemRow | undefined;
    return row === undefined ? null : toItem(row);
  }

  listItems(projectId: string, filter: { ids?: string[]; types?: ItemType[]; status?: string[]; query?: string; stage?: StageId } = {}): Item[] {
    const where = ["project_id = ?"];
    const params: unknown[] = [projectId];
    if (filter.ids !== undefined && filter.ids.length > 0) {
      where.push(`id IN (${filter.ids.map(() => "?").join(",")})`);
      params.push(...filter.ids);
    }
    if (filter.types !== undefined && filter.types.length > 0) {
      where.push(`type IN (${filter.types.map(() => "?").join(",")})`);
      params.push(...filter.types);
    }
    if (filter.status !== undefined && filter.status.length > 0) {
      where.push(`status IN (${filter.status.map(() => "?").join(",")})`);
      params.push(...filter.status);
    }
    if (filter.stage !== undefined) {
      where.push("stage = ?");
      params.push(filter.stage);
    }
    if (filter.query !== undefined && filter.query.trim() !== "") {
      where.push("(title LIKE ? OR body LIKE ? OR id = ?)");
      const q = `%${filter.query.trim()}%`;
      params.push(q, q, filter.query.trim().toUpperCase());
    }
    const rows = this.db.prepare(`SELECT * FROM items WHERE ${where.join(" AND ")} ORDER BY created_at, id`).all(...params) as ItemRow[];
    return rows.map(toItem);
  }

  itemHistory(projectId: string, id: string): { version: number; changedAt: string; sessionId: string | null; note: string | null; snapshot: Item }[] {
    const rows = this.db
      .prepare("SELECT * FROM item_history WHERE project_id = ? AND item_id = ? ORDER BY version DESC")
      .all(projectId, id) as { version: number; changed_at: string; session_id: string | null; note: string | null; snapshot: string }[];
    return rows.map((r) => ({ version: r.version, changedAt: r.changed_at, sessionId: r.session_id, note: r.note, snapshot: JSON.parse(r.snapshot) as Item }));
  }

  /** Creates or updates items in one transaction. Returns items and per-item warnings. */
  upsertItems(projectId: string, inputs: ItemInput[], ctx: WriteContext): { item: Item; created: boolean; warnings: string[] }[] {
    this.getProject(projectId);
    const run = this.db.transaction(() => {
      const results: { item: Item; created: boolean; warnings: string[] }[] = [];
      for (const input of inputs) {
        const warnings: string[] = [];
        const existing = input.id === undefined ? null : this.getItem(projectId, input.id);
        if (input.id !== undefined && existing === null) throw new StoreError(`No item ${input.id} in this project; omit id to create one.`);
        if (existing !== null && existing.type !== input.type) throw new StoreError(`${existing.id} is a ${existing.type}, not a ${input.type}.`);
        if (existing?.type === "decision") throw new StoreError(`Decisions are append-only: record a new decision that replaces ${existing.id}.`);
        const type = input.type;
        const kind = type === "requirement" ? (input.kind ?? existing?.kind ?? null) : null;
        const statuses = ITEM_STATUSES[type];
        const status = input.status ?? existing?.status ?? statuses[0]!;
        if (!statuses.includes(status)) throw new StoreError(`Unknown status "${status}" for ${type}; use one of: ${statuses.join(", ")}.`);
        const sources = input.sources ?? existing?.sources ?? [];
        if (existing === null && SOURCE_REQUIRED.includes(type) && sources.length === 0) {
          throw new StoreError(`A ${type} needs at least one source ({kind, ref, quote?}). If it is a guess, record an assumption instead.`);
        }
        const title = input.title ?? existing?.title;
        if (title === undefined || title.trim() === "") throw new StoreError(`Item of type ${type} needs a title.`);
        const at = now();
        const attrs = { ...(existing?.attrs ?? {}), ...(input.attrs ?? {}) };
        let item: Item;
        if (existing === null) {
          const id = this.nextId(projectId, idPrefix(type, kind));
          item = {
            id, projectId, type, kind, title: title.trim(), body: input.body ?? "", status,
            priority: input.priority ?? null, owner: input.owner ?? null, attrs, sources,
            stage: ctx.stage, sessionId: ctx.sessionId, version: 1, createdAt: at, updatedAt: at,
          };
          this.db
            .prepare(
              `INSERT INTO items (project_id, id, type, kind, title, body, status, priority, owner, attrs, sources, stage, session_id, version, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            )
            .run(projectId, id, type, kind, item.title, item.body, status, item.priority, item.owner, JSON.stringify(attrs), JSON.stringify(sources), ctx.stage, ctx.sessionId, at, at);
        } else {
          item = {
            ...existing, kind, title: title.trim(), body: input.body ?? existing.body, status,
            priority: input.priority === undefined ? existing.priority : input.priority,
            owner: input.owner === undefined ? existing.owner : input.owner,
            attrs, sources, version: existing.version + 1, updatedAt: at,
          };
          this.db
            .prepare(
              `UPDATE items SET kind = ?, title = ?, body = ?, status = ?, priority = ?, owner = ?, attrs = ?, sources = ?, version = ?, updated_at = ? WHERE project_id = ? AND id = ?`,
            )
            .run(kind, item.title, item.body, status, item.priority, item.owner, JSON.stringify(attrs), JSON.stringify(sources), item.version, at, projectId, item.id);
        }
        this.db
          .prepare("INSERT INTO item_history (project_id, item_id, version, snapshot, changed_at, session_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(projectId, item.id, item.version, JSON.stringify(item), at, ctx.sessionId, ctx.note ?? null);
        for (const link of input.links ?? []) {
          this.addLinkRow(projectId, item.id, link.to, link.relation, link.note ?? null);
        }
        if (existing === null && SOURCE_REQUIRED.includes(type) && sources.every((s) => s.quote === undefined) && sources.some((s) => s.kind === "session" || s.kind === "person")) {
          warnings.push("No verbatim quote in the sources; add one when the record comes from what someone said.");
        }
        results.push({ item, created: existing === null, warnings });
      }
      this.touch(projectId);
      return results;
    });
    return run();
  }

  // ── Links ─────────────────────────────────────────────────────────────

  private addLinkRow(projectId: string, from: string, to: string, relation: LinkRelation, note: string | null): void {
    if (from === to) throw new StoreError(`An item cannot link to itself (${from}).`);
    for (const id of [from, to]) {
      if (this.getItem(projectId, id) === null) throw new StoreError(`No item ${id} in this project.`);
    }
    this.db
      .prepare(
        `INSERT INTO links (project_id, from_id, to_id, relation, note, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (project_id, from_id, to_id, relation) DO UPDATE SET note = excluded.note`,
      )
      .run(projectId, from, to, relation, note, now());
  }

  setLinks(projectId: string, links: { from: string; to: string; relation: LinkRelation; note?: string }[], remove: boolean): number {
    const run = this.db.transaction(() => {
      let changed = 0;
      for (const link of links) {
        if (remove) {
          changed += this.db
            .prepare("DELETE FROM links WHERE project_id = ? AND from_id = ? AND to_id = ? AND relation = ?")
            .run(projectId, link.from, link.to, link.relation).changes;
        } else {
          this.addLinkRow(projectId, link.from, link.to, link.relation, link.note ?? null);
          changed++;
        }
      }
      this.touch(projectId);
      return changed;
    });
    return run();
  }

  listLinks(projectId: string): Link[] {
    const rows = this.db.prepare("SELECT * FROM links WHERE project_id = ? ORDER BY created_at").all(projectId) as LinkRow[];
    return rows.map(toLink);
  }

  // ── Documents ─────────────────────────────────────────────────────────

  listDocuments(projectId: string): DocumentSummary[] {
    const rows = this.db.prepare("SELECT * FROM documents WHERE project_id = ? ORDER BY updated_at DESC").all(projectId) as DocumentRow[];
    return rows.map(toDocSummary);
  }

  getDocument(projectId: string, id: string, version?: number): BaDocument {
    const row = this.db.prepare("SELECT * FROM documents WHERE project_id = ? AND id = ?").get(projectId, id) as DocumentRow | undefined;
    if (row === undefined) throw new StoreError(`No document ${id} in this project.`);
    const v = version ?? row.version;
    const ver = this.db
      .prepare("SELECT * FROM document_versions WHERE project_id = ? AND document_id = ? AND version = ?")
      .get(projectId, id, v) as { content: string; note: string | null; status: string } | undefined;
    if (ver === undefined) throw new StoreError(`Document ${id} has no version ${v}.`);
    return { ...toDocSummary(row), version: v, status: ver.status as DocumentStatus, content: ver.content, note: ver.note };
  }

  documentVersions(projectId: string, id: string): { version: number; note: string | null; status: DocumentStatus; sessionId: string | null; createdAt: string }[] {
    const rows = this.db
      .prepare("SELECT version, note, status, session_id, created_at FROM document_versions WHERE project_id = ? AND document_id = ? ORDER BY version DESC")
      .all(projectId, id) as { version: number; note: string | null; status: string; session_id: string | null; created_at: string }[];
    return rows.map((r) => ({ version: r.version, note: r.note, status: r.status as DocumentStatus, sessionId: r.session_id, createdAt: r.created_at }));
  }

  /** Saves a new version. A new document gets an id like `brpv`, `brpv-2`. */
  saveDocument(projectId: string, input: { id?: string; kind: DocumentKind; title: string; content: string; status?: DocumentStatus; note?: string | null }, ctx: WriteContext): BaDocument {
    this.getProject(projectId);
    const run = this.db.transaction(() => {
      const at = now();
      let id = input.id;
      let version = 1;
      if (id !== undefined) {
        const row = this.db.prepare("SELECT * FROM documents WHERE project_id = ? AND id = ?").get(projectId, id) as DocumentRow | undefined;
        if (row === undefined) throw new StoreError(`No document ${id}; omit id to create one.`);
        version = row.version + 1;
        this.db
          .prepare("UPDATE documents SET kind = ?, title = ?, status = ?, version = ?, session_id = ?, updated_at = ? WHERE project_id = ? AND id = ?")
          .run(input.kind, input.title, input.status ?? "draft", version, ctx.sessionId, at, projectId, id);
      } else {
        const base = input.kind.replace(/_/gu, "-");
        id = base;
        for (let n = 2; this.db.prepare("SELECT 1 FROM documents WHERE project_id = ? AND id = ?").get(projectId, id) !== undefined; n++) {
          id = `${base}-${n}`;
        }
        this.db
          .prepare("INSERT INTO documents (project_id, id, kind, title, status, version, stage, session_id, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)")
          .run(projectId, id, input.kind, input.title, input.status ?? "draft", ctx.stage, ctx.sessionId, at);
      }
      this.db
        .prepare("INSERT INTO document_versions (project_id, document_id, version, content, status, note, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(projectId, id, version, input.content, input.status ?? "draft", input.note ?? null, ctx.sessionId, at);
      this.touch(projectId);
      return id;
    });
    return this.getDocument(projectId, run());
  }

  /** Status change without new content keeps the content and adds a version. */
  updateDocument(projectId: string, id: string, patch: { content?: string; status?: DocumentStatus; note?: string }, ctx: WriteContext): BaDocument {
    const current = this.getDocument(projectId, id);
    return this.saveDocument(
      projectId,
      { id, kind: current.kind, title: current.title, content: patch.content ?? current.content, status: patch.status ?? current.status, note: patch.note ?? null },
      ctx,
    );
  }

  // ── Sessions ──────────────────────────────────────────────────────────

  addSession(session: { threadId: string; projectId: string; stage: StageId; title: string }): Session {
    this.db
      .prepare("INSERT OR IGNORE INTO sessions (thread_id, project_id, stage, title, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)")
      .run(session.threadId, session.projectId, session.stage, session.title, now());
    this.touch(session.projectId);
    return this.getSession(session.threadId)!;
  }

  getSession(threadId: string): Session | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE thread_id = ?").get(threadId) as SessionRow | undefined;
    return row === undefined ? null : toSession(row);
  }

  listSessions(projectId: string): Session[] {
    const rows = this.db.prepare("SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at DESC").all(projectId) as SessionRow[];
    return rows.map(toSession);
  }

  closeSession(threadId: string, summary: string | null): Session {
    const session = this.getSession(threadId);
    if (session === null) throw new StoreError("This thread is not a BA session.");
    this.db
      .prepare("UPDATE sessions SET status = 'closed', summary = COALESCE(?, summary), closed_at = ? WHERE thread_id = ?")
      .run(summary, now(), threadId);
    this.touch(session.projectId);
    return this.getSession(threadId)!;
  }

  // ── Snapshot for analysis ────────────────────────────────────────────

  snapshot(projectId: string): ProjectSnapshot {
    return {
      project: this.getProject(projectId),
      items: this.listItems(projectId),
      links: this.listLinks(projectId),
      documents: this.listDocuments(projectId),
      sessions: this.listSessions(projectId),
    };
  }

  countsByType(projectId: string): Record<string, number> {
    const rows = this.db.prepare("SELECT type, COUNT(*) AS n FROM items WHERE project_id = ? GROUP BY type").all(projectId) as { type: string; n: number }[];
    return Object.fromEntries(rows.map((r) => [r.type, r.n]));
  }

  countWhere(projectId: string, type: ItemType, statuses: string[]): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM items WHERE project_id = ? AND type = ? AND status IN (${statuses.map(() => "?").join(",")})`)
      .get(projectId, type, ...statuses) as { n: number };
    return row.n;
  }
}
