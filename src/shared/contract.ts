// RPC contract between server.ts and the app, plus the ba_ask interaction
// payload. Both schemas run at the wire boundary.
import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";
import {
  documentSchema,
  documentStatusSchema,
  documentSummarySchema,
  gateStatusSchema,
  itemSchema,
  itemTypeSchema,
  linkSchema,
  PROJECT_ID_PATTERN,
  projectSchema,
  sessionSchema,
  stageIdSchema,
} from "./model";

export { PROJECT_CHANGED, ASK_RENDERER_ID, askOptionSchema, askQuestionSchema, askPayloadSchema, askAnswerSchema, askResponseSchema } from "./ask";
export type { AskPayload, AskResponse } from "./ask";

export const projectCountsSchema = z.object({
  sessions: z.number().int(),
  activeSessions: z.number().int(),
  documents: z.number().int(),
  requirements: z.number().int(),
  openQuestions: z.number().int(),
  openConflicts: z.number().int(),
  openAssumptions: z.number().int(),
  /** Item count per type. */
  byType: z.record(z.string(), z.number().int()),
});
export type ProjectCounts = z.infer<typeof projectCountsSchema>;

export const projectListEntrySchema = projectSchema.extend({ counts: projectCountsSchema });
export type ProjectListEntry = z.infer<typeof projectListEntrySchema>;

export const itemHistoryEntrySchema = z.object({
  version: z.number().int(),
  changedAt: z.string(),
  sessionId: z.string().nullable(),
  note: z.string().nullable(),
  snapshot: itemSchema,
});

export const documentVersionSchema = z.object({
  version: z.number().int(),
  note: z.string().nullable(),
  status: documentStatusSchema,
  sessionId: z.string().nullable(),
  createdAt: z.string(),
});

const projectRef = z.object({ projectId: z.string().regex(PROJECT_ID_PATTERN) });

export const rpcContract = defineRpcContract({
  projects_list: {
    input: z.object({ includeArchived: z.boolean().optional() }),
    output: z.object({ projects: z.array(projectListEntrySchema) }),
  },
  /** BB projects the user can bind a BA project to. */
  bb_projects_list: {
    input: z.null(),
    output: z.object({ projects: z.array(z.object({ id: z.string(), name: z.string() })) }),
  },
  project_create: {
    input: z.object({
      name: z.string().trim().min(1).max(120),
      /** Latin slug; derived from the name when omitted. */
      id: z.string().regex(PROJECT_ID_PATTERN).optional(),
      goal: z.string().trim().max(2000).default(""),
      product: z.string().trim().max(300).default(""),
      bbProjectId: z.string().min(1),
      language: z.string().trim().min(2).max(10).default("ru"),
      sensitive: z.boolean().default(false),
      /** "plan" for the full path, "one-pass" for the fast mode. */
      startStage: z.enum(["plan", "one-pass"]).default("plan"),
    }),
    output: projectSchema,
  },
  project_update: {
    input: projectRef.extend({
      name: z.string().trim().min(1).max(120).optional(),
      goal: z.string().trim().max(2000).optional(),
      product: z.string().trim().max(300).optional(),
      bbProjectId: z.string().min(1).optional(),
      language: z.string().trim().min(2).max(10).optional(),
      sensitive: z.boolean().optional(),
      archived: z.boolean().optional(),
    }),
    output: projectSchema,
  },
  project_get: {
    input: projectRef,
    output: z.object({
      project: projectSchema,
      counts: projectCountsSchema,
      sessions: z.array(sessionSchema),
      documents: z.array(documentSummarySchema),
      gate: gateStatusSchema,
    }),
  },
  gate_get: {
    input: projectRef.extend({ stage: stageIdSchema }),
    output: gateStatusSchema,
  },
  stage_set: {
    input: projectRef.extend({ stage: stageIdSchema, acceptRisk: z.string().trim().max(2000).optional() }),
    output: projectSchema,
  },
  session_start: {
    input: projectRef.extend({
      stage: stageIdSchema,
      /** What the user wants from this session; becomes part of the first message. */
      goal: z.string().trim().max(4000).optional(),
    }),
    output: sessionSchema,
  },
  session_close: {
    input: z.object({ threadId: z.string().min(1), summary: z.string().trim().max(8000).optional() }),
    output: sessionSchema,
  },
  sessions_list: {
    input: projectRef,
    output: z.object({ sessions: z.array(sessionSchema) }),
  },
  documents_list: {
    input: projectRef,
    output: z.object({ documents: z.array(documentSummarySchema) }),
  },
  document_get: {
    input: projectRef.extend({ id: z.string().min(1), version: z.number().int().positive().optional() }),
    output: documentSchema,
  },
  document_versions: {
    input: projectRef.extend({ id: z.string().min(1) }),
    output: z.object({ versions: z.array(documentVersionSchema) }),
  },
  /** User edits or approval from the reader. */
  document_update: {
    input: projectRef.extend({
      id: z.string().min(1),
      content: z.string().max(500_000).optional(),
      status: documentStatusSchema.optional(),
      note: z.string().trim().max(500).optional(),
    }),
    output: documentSchema,
  },
  items_list: {
    input: projectRef.extend({
      types: z.array(itemTypeSchema).optional(),
      status: z.array(z.string()).optional(),
      query: z.string().trim().max(200).optional(),
    }),
    output: z.object({ items: z.array(itemSchema) }),
  },
  item_get: {
    input: projectRef.extend({ id: z.string().min(1) }),
    output: z.object({
      item: itemSchema,
      outgoing: z.array(linkSchema.extend({ title: z.string() })),
      incoming: z.array(linkSchema.extend({ title: z.string() })),
      history: z.array(itemHistoryEntrySchema),
    }),
  },
  trace_matrix: {
    input: projectRef.extend({
      from: z.array(itemTypeSchema).optional(),
      to: z.array(itemTypeSchema).optional(),
    }),
    output: z.object({
      rows: z.array(z.object({ id: z.string(), title: z.string(), priority: z.string().nullable() })),
      columns: z.array(z.object({ id: z.string(), title: z.string() })),
      cells: z.array(z.object({ row: z.string(), column: z.string(), relation: z.string() })),
    }),
  },
  /** The whole project as Markdown files (documents + registers) for download. */
  export_markdown: {
    input: projectRef,
    output: z.object({ files: z.array(z.object({ path: z.string(), content: z.string() })) }),
  },
});
export type RpcContract = typeof rpcContract;

