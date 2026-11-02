// Runtime-safe constants and schemas shared by server and app (no SDK
// import, so the app bundle can import them).
import { z } from "zod";

/** Realtime channel; payload `{ projectId }`. Published after every write. */
export const PROJECT_CHANGED = "project-changed";

// ── ba_ask interaction (bb.ui.requestInput ↔ pendingInteraction slot) ────

export const ASK_RENDERER_ID = "ask";

export const askOptionSchema = z.object({
  label: z.string().min(1).max(300),
  description: z.string().max(1000).optional(),
  recommended: z.boolean().optional(),
});

export const askQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  question: z.string().min(1).max(2000),
  why: z.string().max(1000).optional(),
  options: z.array(askOptionSchema).max(6).optional(),
  allow_free_text: z.boolean().optional(),
  allow_unknown: z.boolean().optional(),
});

export const askPayloadSchema = z.object({
  title: z.string().min(1).max(200),
  questions: z.array(askQuestionSchema).min(1).max(3),
});
export type AskPayload = z.infer<typeof askPayloadSchema>;

export const askAnswerSchema = z.object({
  id: z.string(),
  /** Picked option label or free text; empty for unknown/skipped. */
  answer: z.string().max(4000),
  status: z.enum(["confirmed", "overridden", "unknown", "skipped"]),
});
export const askResponseSchema = z.object({ answers: z.array(askAnswerSchema) });
export type AskResponse = z.infer<typeof askResponseSchema>;
