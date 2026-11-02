import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { kickoffPrompt } from "../../src/server/rpc";
import { renderExport } from "../../src/server/render";
import { MIGRATIONS, slugify, Store, StoreError } from "../../src/server/store";

function makeStore(): Store {
  const db = new Database(":memory:");
  for (const sql of MIGRATIONS) db.exec(sql);
  return new Store(db);
}

const ctx = { stage: "elicit" as const, sessionId: "thr_1" };

describe("Store", () => {
  let store: Store;
  beforeEach(() => {
    store = makeStore();
    store.createProject({ name: "Оплата подписки", goal: "", product: "Selfy", bbProjectId: "proj_1", language: "ru", sensitive: false, stage: "plan" });
  });

  it("slugifies Cyrillic names and dedupes ids", () => {
    expect(slugify("Оплата подписки")).toBe("oplata-podpiski");
    const second = store.createProject({ name: "Оплата подписки", goal: "", product: "", bbProjectId: "p", language: "ru", sensitive: false, stage: "plan" });
    expect(second.id).toBe("oplata-podpiski-2");
  });

  it("assigns typed IDs per prefix and requirement kind", () => {
    const res = store.upsertItems(
      "oplata-podpiski",
      [
        { type: "stakeholder", title: "CEO" },
        { type: "requirement", kind: "business", title: "Клиент должен видеть статус", sources: [{ kind: "person", ref: "CEO", quote: "хочу видеть" }] },
        { type: "requirement", kind: "functional", title: "Система показывает статус", sources: [{ kind: "item", ref: "BR-1" }] },
        { type: "stakeholder", title: "Бухгалтер" },
      ],
      ctx,
    );
    expect(res.map((r) => r.item.id)).toEqual(["ST-1", "BR-1", "FR-1", "ST-2"]);
  });

  it("refuses source-less facts and requirements without kind", () => {
    expect(() => store.upsertItems("oplata-podpiski", [{ type: "fact", title: "x" }], ctx)).toThrow(StoreError);
    expect(() => store.upsertItems("oplata-podpiski", [{ type: "requirement", title: "x", sources: [{ kind: "url", ref: "u" }] }], ctx)).toThrow(/kind/u);
  });

  it("rolls back the whole batch on error", () => {
    expect(() =>
      store.upsertItems("oplata-podpiski", [{ type: "stakeholder", title: "A" }, { type: "fact", title: "no source" }], ctx),
    ).toThrow();
    expect(store.listItems("oplata-podpiski")).toHaveLength(0);
  });

  it("updates with history and merges attrs; decisions are append-only", () => {
    store.upsertItems("oplata-podpiski", [{ type: "goal", title: "Снизить отток", attrs: { kpi: "churn" } }], ctx);
    const [upd] = store.upsertItems("oplata-podpiski", [{ id: "G-1", type: "goal", attrs: { target: "5%" } }], ctx);
    expect(upd!.item.version).toBe(2);
    expect(upd!.item.attrs).toEqual({ kpi: "churn", target: "5%" });
    expect(store.itemHistory("oplata-podpiski", "G-1")).toHaveLength(2);
    store.upsertItems("oplata-podpiski", [{ type: "decision", title: "Идём дальше" }], ctx);
    expect(() => store.upsertItems("oplata-podpiski", [{ id: "D-1", type: "decision", title: "other" }], ctx)).toThrow(/append-only/u);
  });

  it("validates statuses and links", () => {
    expect(() => store.upsertItems("oplata-podpiski", [{ type: "question", title: "q", status: "done" }], ctx)).toThrow(/status/u);
    store.upsertItems("oplata-podpiski", [{ type: "stakeholder", title: "A" }, { type: "question", title: "q" }], ctx);
    expect(store.setLinks("oplata-podpiski", [{ from: "Q-1", to: "ST-1", relation: "owned_by" }], false)).toBe(1);
    expect(() => store.setLinks("oplata-podpiski", [{ from: "Q-1", to: "X-9", relation: "owned_by" }], false)).toThrow(/X-9/u);
    expect(store.setLinks("oplata-podpiski", [{ from: "Q-1", to: "ST-1", relation: "owned_by" }], true)).toBe(1);
  });

  it("versions documents and keeps content on status change", () => {
    const doc = store.saveDocument("oplata-podpiski", { kind: "brpv", title: "BRPV", content: "# v1" }, ctx);
    expect(doc.id).toBe("brpv");
    store.saveDocument("oplata-podpiski", { id: "brpv", kind: "brpv", title: "BRPV", content: "# v2" }, ctx);
    const approved = store.updateDocument("oplata-podpiski", "brpv", { status: "approved" }, { stage: null, sessionId: null });
    expect(approved.version).toBe(3);
    expect(approved.content).toBe("# v2");
    expect(store.getDocument("oplata-podpiski", "brpv", 1).content).toBe("# v1");
    expect(store.saveDocument("oplata-podpiski", { kind: "brpv", title: "BRPV 2", content: "x" }, ctx).id).toBe("brpv-2");
  });

  it("registers sessions idempotently and closes them", () => {
    store.addSession({ threadId: "thr_1", projectId: "oplata-podpiski", stage: "elicit", title: "t" });
    store.addSession({ threadId: "thr_1", projectId: "oplata-podpiski", stage: "plan", title: "other" });
    expect(store.listSessions("oplata-podpiski")).toHaveLength(1);
    expect(store.getSession("thr_1")!.stage).toBe("elicit");
    expect(store.closeSession("thr_1", "done").status).toBe("closed");
  });

  it("renders an export bundle and a kickoff prompt", () => {
    store.upsertItems("oplata-podpiski", [{ type: "stakeholder", title: "CEO" }], ctx);
    const files = renderExport(store.snapshot("oplata-podpiski"), [{ id: "brpv", title: "BRPV", content: "# x" }]);
    expect(files.map((f) => f.path)).toEqual(["README.md", "documents/brpv.md", "registers/stakeholder.md", "registers/links.md"]);
    expect(kickoffPrompt({ name: "X", language: "ru" }, "elicit", undefined)).toContain("«Выявление»");
    expect(kickoffPrompt({ name: "X", language: "en" }, "plan", "map stakeholders")).toContain("Session goal: map stakeholders");
  });
});
