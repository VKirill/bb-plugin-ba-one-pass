// Shared domain model of BA One Pass: stages, register item types, links,
// documents. Imported by the server, the app and the tests; keep it free of
// runtime dependencies other than zod.
//
// Methodology map adapted from AIналитик (https://github.com/chaussky/ainalyst),
// Copyright (c) 2026 Anatoly Chaussky, AGPL-3.0. See NOTICE.md.
import { z } from "zod";

// ── Stages ────────────────────────────────────────────────────────────────
// A session (BB thread) belongs to exactly one stage. The stage decides which
// skills, tools and instructions the session gets (bb.agents.configure).

export const STAGE_IDS = [
  "plan", // BABOK ch. 3 — planning and monitoring
  "elicit", // ch. 4 — elicitation and collaboration
  "strategy", // ch. 6 — strategy analysis
  "requirements", // ch. 7 — requirements analysis and design definition
  "lifecycle", // ch. 5 — requirements life cycle (also available in every stage)
  "one-pass", // fast mode: whole cycle to a BRPV draft in one session
] as const;
export const stageIdSchema = z.enum(STAGE_IDS);
export type StageId = z.infer<typeof stageIdSchema>;

/** Stages that form the main path, in order. */
export const PATH_STAGES = ["plan", "elicit", "strategy", "requirements"] as const satisfies readonly StageId[];

// ── Register items ────────────────────────────────────────────────────────

export const ITEM_TYPES = [
  "stakeholder",
  "source", // an input: transcript, file, document, URL, code area
  "fact", // an elicited statement with a source
  "question",
  "assumption",
  "conflict",
  "decision", // append-only decision log
  "need", // business need (6.1)
  "goal", // business goal / objective with KPI (6.2)
  "state", // current/future state element (6.1/6.2); attrs.side
  "cause", // root cause (6.1)
  "gap", // gap between current and future state (6.2)
  "constraint",
  "risk",
  "requirement", // kind: business | stakeholder | functional | nonfunctional | transition
  "rule", // business rule
  "scenario", // business scenario / use case / user story
  "criterion", // acceptance criterion (Given/When/Then)
  "option", // design option (7.5)
  "change", // change request (5.4)
  "issue", // verification / validation issue (7.2/7.3)
  "term", // glossary term
] as const;
export const itemTypeSchema = z.enum(ITEM_TYPES);
export type ItemType = z.infer<typeof itemTypeSchema>;

export const REQUIREMENT_KINDS = [
  "business",
  "stakeholder",
  "functional",
  "nonfunctional",
  "transition",
] as const;
export const requirementKindSchema = z.enum(REQUIREMENT_KINDS);
export type RequirementKind = z.infer<typeof requirementKindSchema>;

/** ID prefix per type (requirements by kind). IDs look like `BR-3`. */
export const ID_PREFIX: Record<Exclude<ItemType, "requirement">, string> & {
  requirement: Record<RequirementKind, string>;
} = {
  stakeholder: "ST",
  source: "SRC",
  fact: "F",
  question: "Q",
  assumption: "ASM",
  conflict: "CON",
  decision: "D",
  need: "BN",
  goal: "G",
  state: "SE",
  cause: "RC",
  gap: "GAP",
  constraint: "CN",
  risk: "R",
  requirement: {
    business: "BR",
    stakeholder: "SR",
    functional: "FR",
    nonfunctional: "NFR",
    transition: "TR",
  },
  rule: "RULE",
  scenario: "SC",
  criterion: "AC",
  option: "OPT",
  change: "CR",
  issue: "VI",
  term: "GL",
};

/** Allowed statuses per type; the first one is the default. */
export const ITEM_STATUSES: Record<ItemType, readonly string[]> = {
  stakeholder: ["active", "inactive"],
  source: ["received", "processed"],
  fact: ["draft", "confirmed", "rejected"],
  question: ["open", "answered", "deferred", "out_of_scope"],
  assumption: ["open", "confirmed", "invalidated"],
  conflict: ["open", "resolved", "accepted"],
  decision: ["recorded", "superseded"],
  need: ["draft", "confirmed", "deprecated"],
  goal: ["draft", "confirmed", "deprecated"],
  state: ["draft", "confirmed"],
  cause: ["draft", "confirmed"],
  gap: ["open", "addressed", "accepted"],
  constraint: ["active", "lifted"],
  risk: ["open", "mitigated", "accepted", "closed"],
  requirement: ["draft", "verified", "validated", "approved", "deprecated", "rejected"],
  rule: ["draft", "verified", "approved", "deprecated"],
  scenario: ["draft", "verified", "approved", "deprecated"],
  criterion: ["draft", "verified", "approved", "deprecated"],
  option: ["proposed", "recommended", "rejected"],
  change: ["open", "assessed", "approved", "rejected", "implemented"],
  issue: ["open", "resolved", "wont_fix"],
  term: ["active"],
};

/** Types whose records must cite at least one source (anti-hallucination). */
export const SOURCE_REQUIRED: readonly ItemType[] = [
  "fact",
  "requirement",
  "rule",
  "need",
  "conflict",
];

export const PRIORITIES = ["must", "should", "could", "wont"] as const;
export const prioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof prioritySchema>;

export const itemSourceSchema = z.object({
  /** session = a message in a BA session; document = a BA document; item = another register item;
   * file = a file path on the project machine; url = external; person = said by a stakeholder. */
  kind: z.enum(["session", "document", "item", "file", "url", "person"]),
  ref: z.string().min(1).max(500),
  /** Verbatim quote supporting the record, when available. */
  quote: z.string().max(2000).optional(),
});
export type ItemSource = z.infer<typeof itemSourceSchema>;

export const itemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: itemTypeSchema,
  kind: requirementKindSchema.nullable(),
  title: z.string(),
  body: z.string(),
  status: z.string(),
  priority: prioritySchema.nullable(),
  owner: z.string().nullable(),
  attrs: z.record(z.string(), z.unknown()),
  sources: z.array(itemSourceSchema),
  stage: stageIdSchema.nullable(),
  sessionId: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Item = z.infer<typeof itemSchema>;

// ── Links (traceability graph) ────────────────────────────────────────────

export const LINK_RELATIONS = [
  "derives_from", // requirement ← need/goal/fact
  "satisfies", // requirement/option → goal/need
  "verifies", // criterion → requirement/scenario
  "refines", // detailed → general
  "depends_on",
  "conflicts_with",
  "mitigates", // requirement/option → risk
  "impacts", // change/risk → anything
  "addresses", // requirement/option → gap/cause
  "owned_by", // anything → stakeholder
  "sourced_from", // anything → source
  "replaces",
] as const;
export const linkRelationSchema = z.enum(LINK_RELATIONS);
export type LinkRelation = z.infer<typeof linkRelationSchema>;

export const linkSchema = z.object({
  from: z.string(),
  to: z.string(),
  relation: linkRelationSchema,
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type Link = z.infer<typeof linkSchema>;

// ── Documents ─────────────────────────────────────────────────────────────

export const DOCUMENT_KINDS = [
  "brpv",
  "ba_plan",
  "elicitation_plan",
  "interview_notes",
  "meeting_notes",
  "confirmed_results",
  "comm_package",
  "current_state",
  "future_state",
  "risk_assessment",
  "change_strategy",
  "requirements_spec",
  "verification_report",
  "validation_report",
  "architecture",
  "design_options",
  "recommendation",
  "traceability",
  "prioritization",
  "change_decision",
  "approval_package",
  "baseline",
  "session_summary",
  "other",
] as const;
export const documentKindSchema = z.enum(DOCUMENT_KINDS);
export type DocumentKind = z.infer<typeof documentKindSchema>;

export const DOCUMENT_STATUSES = ["draft", "review", "approved"] as const;
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const documentSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  kind: documentKindSchema,
  title: z.string(),
  status: documentStatusSchema,
  version: z.number().int(),
  stage: stageIdSchema.nullable(),
  sessionId: z.string().nullable(),
  updatedAt: z.string(),
});
export type DocumentSummary = z.infer<typeof documentSummarySchema>;

export const documentSchema = documentSummarySchema.extend({
  content: z.string(),
  note: z.string().nullable(),
});
export type BaDocument = z.infer<typeof documentSchema>;

// ── Projects and sessions ────────────────────────────────────────────────

export const projectSchema = z.object({
  id: z.string(), // latin slug, unique
  name: z.string(),
  goal: z.string(),
  product: z.string(),
  /** BB project whose environment runs the sessions (gives the agent the product's code and docs). */
  bbProjectId: z.string(),
  /** Language of the documents, e.g. "ru" or "en". Agent instructions stay English. */
  language: z.string(),
  /** Sensitive projects show a warning about where data goes. */
  sensitive: z.boolean(),
  stage: stageIdSchema,
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const SESSION_STATUSES = ["active", "closed"] as const;
export const sessionSchema = z.object({
  threadId: z.string(),
  projectId: z.string(),
  stage: stageIdSchema,
  title: z.string(),
  status: z.enum(SESSION_STATUSES),
  summary: z.string().nullable(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
});
export type Session = z.infer<typeof sessionSchema>;

// ── Gates ────────────────────────────────────────────────────────────────

export const gateCheckSchema = z.object({
  id: z.string(),
  /** i18n key for the UI; the agent gets `detail`. */
  label: z.string(),
  passed: z.boolean(),
  /** Blocking checks warn strongly; nothing hard-blocks (warn, don't block). */
  blocking: z.boolean(),
  detail: z.string(),
  /** Item IDs that fail the check, at most 20. */
  items: z.array(z.string()),
});
export type GateCheck = z.infer<typeof gateCheckSchema>;

export const gateStatusSchema = z.object({
  stage: stageIdSchema,
  ready: z.boolean(),
  checks: z.array(gateCheckSchema),
});
export type GateStatus = z.infer<typeof gateStatusSchema>;

/** Thread plugin metadata namespace written at session spawn. */
export const sessionMetadataSchema = z.object({
  projectId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/u),
  stage: stageIdSchema,
});
export type SessionMetadata = z.infer<typeof sessionMetadataSchema>;

export const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
