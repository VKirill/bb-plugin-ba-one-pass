import { describe, expect, it } from "vitest";
import { askPayloadSchema, askResponseSchema } from "../../src/shared/ask";
import {
  buildAskAnswers,
  extractToc,
  ITEM_LINK_PREFIX,
  linkifyItemIds,
  parseAskPayload,
  parseRoute,
  routePath,
  type Route,
} from "../../src/app/helpers";
import { DICTIONARIES } from "../../src/app/i18n";
import { ITEM_STATUSES, ITEM_TYPES, PRIORITIES, STAGE_IDS } from "../../src/shared/model";

describe("linkifyItemIds", () => {
  it("links register ids in plain text", () => {
    expect(linkifyItemIds("See BR-3 and AC-12.")).toBe(
      `See [BR-3](${ITEM_LINK_PREFIX}BR-3) and [AC-12](${ITEM_LINK_PREFIX}AC-12).`,
    );
  });

  it("leaves code, existing links, headings and lookalikes alone", () => {
    const source = [
      "## BR-1 heading",
      "Inline `BR-2` code and [BR-3](https://x) link, but XBR-4 and BR-x stay.",
      "```",
      "BR-5 in a fence",
      "```",
      "Q-6 after the fence",
    ].join("\n");
    const out = linkifyItemIds(source).split("\n");
    expect(out[0]).toBe("## BR-1 heading");
    expect(out[1]).toBe("Inline `BR-2` code and [BR-3](https://x) link, but XBR-4 and BR-x stay.");
    expect(out[3]).toBe("BR-5 in a fence");
    expect(out[5]).toBe(`[Q-6](${ITEM_LINK_PREFIX}Q-6) after the fence`);
  });

  it("links NFR before matching the shorter prefixes", () => {
    expect(linkifyItemIds("NFR-2")).toBe(`[NFR-2](${ITEM_LINK_PREFIX}NFR-2)`);
  });
});

describe("extractToc", () => {
  it("collects headings up to level 3 outside fences, keeping the global index", () => {
    const toc = extractToc(["# Title", "```", "# not a heading", "```", "## **Goals**", "#### deep", "### [Scope](x)"].join("\n"));
    expect(toc).toEqual([
      { level: 1, text: "Title", index: 0 },
      { level: 2, text: "Goals", index: 1 },
      { level: 3, text: "Scope", index: 3 },
    ]);
  });
});

describe("routes", () => {
  it("round-trips every route", () => {
    const routes: Route[] = [
      { kind: "projects" },
      { kind: "overview", projectId: "pay" },
      { kind: "session", projectId: "pay", threadId: "thr_1" },
      { kind: "document", projectId: "pay", documentId: "DOC-1" },
      { kind: "register", projectId: "pay", type: "requirement" },
      { kind: "trace", projectId: "pay" },
    ];
    for (const route of routes) expect(parseRoute(routePath(route))).toEqual(route);
  });

  it("decodes segments and falls back on unknown register types", () => {
    expect(parseRoute("p/pay/d/doc%201")).toEqual({ kind: "document", projectId: "pay", documentId: "doc 1" });
    expect(parseRoute("p/pay/r/bogus")).toEqual({ kind: "overview", projectId: "pay" });
    expect(parseRoute("nonsense")).toEqual({ kind: "projects" });
  });
});

describe("ask payload", () => {
  const payload = askPayloadSchema.parse({
    title: "Refunds",
    questions: [
      {
        id: "q1",
        question: "Refund window?",
        why: "BR-4 depends on it",
        options: [{ label: "14 days", recommended: true }, { label: "30 days" }],
        allow_free_text: true,
      },
      { id: "q2", question: "Who approves?" },
      { id: "q3", question: "Currency?", options: [{ label: "RUB" }], allow_unknown: false },
    ],
  });

  it("parses the shared schema's payload", () => {
    const view = parseAskPayload(payload);
    expect(view?.questions.map((q) => [q.id, q.allowFreeText, q.allowUnknown])).toEqual([
      ["q1", true, true],
      ["q2", true, true], // no options → free text is the only way to answer
      ["q3", false, false],
    ]);
    expect(parseAskPayload({ title: "x" })).toBeNull();
    expect(parseAskPayload({ title: "x", questions: [] })).toBeNull();
  });

  it("builds answers with statuses the server schema accepts", () => {
    const view = parseAskPayload(payload);
    if (view === null) throw new Error("payload did not parse");
    const confirmed = buildAskAnswers(view.questions, {
      q1: { kind: "option", index: 0 },
      q2: { kind: "text", text: "  CFO " },
    });
    expect(confirmed).toEqual([
      { id: "q1", answer: "14 days", status: "confirmed" },
      { id: "q2", answer: "CFO", status: "overridden" },
      { id: "q3", answer: "", status: "skipped" },
    ]);
    const other = buildAskAnswers(view.questions, { q1: { kind: "option", index: 1 }, q2: { kind: "unknown" } });
    expect(other.map((answer) => answer.status)).toEqual(["overridden", "unknown", "skipped"]);
    expect(askResponseSchema.parse({ answers: other }).answers).toHaveLength(3);
  });
});

describe("i18n", () => {
  it("Russian has exactly the English keys, none empty", () => {
    expect(Object.keys(DICTIONARIES.ru).sort()).toEqual(Object.keys(DICTIONARIES.en).sort());
    for (const value of Object.values(DICTIONARIES.ru)) expect(value.trim()).not.toBe("");
  });

  it("covers every stage, type, status and priority label", () => {
    const keys = new Set(Object.keys(DICTIONARIES.en));
    const expected = [
      ...STAGE_IDS.map((stage) => `stage_${stage}`),
      ...ITEM_TYPES.map((type) => `type_${type}`),
      ...[...new Set(Object.values(ITEM_STATUSES).flat())].map((status) => `st_${status}`),
      ...PRIORITIES.map((priority) => `priority_${priority}`),
    ];
    expect(expected.filter((key) => !keys.has(key))).toEqual([]);
  });
});
