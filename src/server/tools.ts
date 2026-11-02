// Native agent tools of a BA session. The session (thread) is resolved from
// the plugin store, never from thread metadata, so an agent cannot point a
// tool at another project by rewriting its metadata.
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { ASK_RENDERER_ID, askPayloadSchema, askResponseSchema } from "../shared/contract";
import {
  documentKindSchema,
  documentStatusSchema,
  itemSourceSchema,
  itemTypeSchema,
  linkRelationSchema,
  prioritySchema,
  requirementKindSchema,
  sessionMetadataSchema,
  stageIdSchema,
  type Session,
  type StageId,
} from "../shared/model";
import {
  calcInputSchema,
  calcToolSchema,
  checkQuality,
  evaluateGate,
  lintText,
  runCalc,
  traceCoverage,
  traceImpact,
  traceMatrix,
  traceOrphans,
} from "./analysis";
import { clip, CONTEXT_SECTIONS, itemLine, renderContext } from "./render";
import { StoreError, type Store } from "./store";
import { LIFECYCLE_SKILLS, STAGES } from "../shared/stages";

export const TOOL_NAMES = [
  "ba_context",
  "ba_items",
  "ba_record",
  "ba_link",
  "ba_trace",
  "ba_documents",
  "ba_document_save",
  "ba_check_quality",
  "ba_calc",
  "ba_gate",
  "ba_ask",
  "ba_stage_set",
  "ba_session_close",
] as const;

const LINT_TYPES = new Set(["requirement", "rule", "criterion", "goal"]);

type ToolResult = string | { content: { type: "text"; text: string }[]; isError?: boolean };

const fail = (text: string): ToolResult => ({ content: [{ type: "text", text }], isError: true });

export function registerTools(bb: BbPluginApi, store: Store, changed: (projectId: string) => void): void {
  /** The open ba_ask card of each session, so a newer card can close it. */
  const openAsks = new Map<string, AbortController>();
  /** The store is authoritative. A thread spawned a moment ago may run its first tool
   * before session_start recorded it; then the spawn metadata registers it. */
  async function sessionOf(threadId: string): Promise<Session> {
    const known = store.getSession(threadId);
    if (known !== null) return known;
    const meta = sessionMetadataSchema.safeParse(await bb.sdk.threads.getPluginMetadata({ threadId }));
    if (!meta.success) throw new StoreError("This thread is not a BA One Pass session. Start one from the BA One Pass panel.");
    const project = store.getProject(meta.data.projectId);
    return store.addSession({ threadId, projectId: project.id, stage: meta.data.stage, title: sessionTitle(project.name, meta.data.stage, project.language) });
  }

  /** Wraps execute: resolves the session, maps store errors to tool errors. */
  function tool<S extends z.ZodType>(
    name: (typeof TOOL_NAMES)[number],
    description: string,
    labels: { pending: string; completed: string },
    parameters: S,
    run: (args: z.infer<S>, session: Session, signal: AbortSignal) => Promise<ToolResult> | ToolResult,
  ): void {
    bb.agents.registerTool({
      name,
      description,
      presentation: { label: labels, icon: { glyph: "ba-one-pass/clipboard" } },
      parameters,
      async execute(args: z.infer<S>, ctx: { threadId: string; signal: AbortSignal }) {
        try {
          return await run(args, await sessionOf(ctx.threadId), ctx.signal);
        } catch (error) {
          if (error instanceof StoreError) return fail(error.message);
          throw error;
        }
      },
    });
  }

  const write = (session: Session, note?: string) => ({ stage: session.stage, sessionId: session.threadId, note: note ?? null });

  tool(
    "ba_context",
    "Snapshot of the BA project for this session: summary, plan, stakeholders, open items, stage gate, documents, sessions. Call it first in every session.",
    { pending: "Reading BA project", completed: "Read BA project" },
    z.object({ include: z.array(z.enum(CONTEXT_SECTIONS)).optional() }),
    ({ include }, session) => {
      const s = store.snapshot(session.projectId);
      const plan = s.documents.find((d) => d.kind === "ba_plan");
      const planContent = plan === undefined ? null : store.getDocument(session.projectId, plan.id).content;
      const sections = include ?? ["summary", "plan", "stakeholders", "open", "gate", "documents"];
      return renderContext(s, session.stage, evaluateGate(s, session.stage), sections, planContent);
    },
  );

  tool(
    "ba_items",
    "List or read register items (stakeholders, facts, questions, assumptions, conflicts, goals, requirements, criteria, risks…). full=true adds body, attrs, sources and links.",
    { pending: "Reading registers", completed: "Read registers" },
    z.object({
      ids: z.array(z.string()).max(200).optional(),
      types: z.array(itemTypeSchema).optional(),
      status: z.array(z.string()).optional(),
      query: z.string().max(200).optional(),
      stage: stageIdSchema.optional(),
      limit: z.number().int().min(1).max(200).optional(),
      full: z.boolean().optional(),
    }),
    ({ limit, full, ...filter }, session) => {
      const items = store.listItems(session.projectId, filter).slice(0, limit ?? 100);
      if (items.length === 0) return "No matching items.";
      if (full !== true) return clip(items.map(itemLine).join("\n"));
      const links = store.listLinks(session.projectId);
      return clip(
        items
          .map((item) => {
            const out = links.filter((l) => l.from === item.id).map((l) => `${l.relation} → ${l.to}`);
            const inc = links.filter((l) => l.to === item.id).map((l) => `${l.from} ${l.relation} →`);
            return [
              itemLine(item),
              item.kind === null ? null : `  kind: ${item.kind}`,
              item.owner === null ? null : `  owner: ${item.owner}`,
              item.body.trim() === "" ? null : `  body: ${item.body.trim().replace(/\n/gu, "\n  ")}`,
              Object.keys(item.attrs).length === 0 ? null : `  attrs: ${JSON.stringify(item.attrs)}`,
              item.sources.length === 0 ? null : `  sources: ${item.sources.map((s) => `${s.kind}:${s.ref}${s.quote ? ` «${s.quote}»` : ""}`).join("; ")}`,
              out.length + inc.length === 0 ? null : `  links: ${[...out, ...inc].join("; ")}`,
            ]
              .filter((line) => line !== null)
              .join("\n");
          })
          .join("\n\n"),
      );
    },
  );

  tool(
    "ba_record",
    "Create (no id) or update (with id) register items in one batch (≤50). Facts, requirements, rules, needs and conflicts need sources; a guess is an assumption. Decisions are append-only. Returns assigned IDs and warnings.",
    { pending: "Recording to registers", completed: "Recorded to registers" },
    z.object({
      items: z
        .array(
          z.object({
            id: z.string().optional(),
            type: itemTypeSchema,
            kind: requirementKindSchema.optional(),
            title: z.string().max(500).optional(),
            body: z.string().max(20_000).optional(),
            status: z.string().optional(),
            priority: prioritySchema.nullable().optional(),
            owner: z.string().max(200).nullable().optional(),
            attrs: z.record(z.string(), z.unknown()).optional(),
            sources: z.array(itemSourceSchema).max(20).optional(),
            links: z.array(z.object({ to: z.string(), relation: linkRelationSchema, note: z.string().max(500).optional() })).max(20).optional(),
          }),
        )
        .min(1)
        .max(50),
      note: z.string().max(500).optional(),
    }),
    ({ items, note }, session) => {
      const s = store.getProject(session.projectId);
      const results = store.upsertItems(session.projectId, items, write(session, note));
      changed(session.projectId);
      return results
        .map(({ item, created, warnings }) => {
          const lint = LINT_TYPES.has(item.type) ? lintText(`${item.title}\n${item.body}`, s.language) : [];
          const all = [...warnings, ...lint];
          return `${created ? "created" : "updated"} ${item.id} v${item.version} — ${item.title}${all.length > 0 ? `\n  ⚠ ${all.join("\n  ⚠ ")}` : ""}`;
        })
        .join("\n");
    },
  );

  tool(
    "ba_link",
    "Add (or remove with remove=true) traceability links between items.",
    { pending: "Linking items", completed: "Linked items" },
    z.object({
      links: z.array(z.object({ from: z.string(), to: z.string(), relation: linkRelationSchema, note: z.string().max(500).optional() })).min(1).max(100),
      remove: z.boolean().optional(),
    }),
    ({ links, remove }, session) => {
      const n = store.setLinks(session.projectId, links, remove === true);
      changed(session.projectId);
      return `${remove === true ? "Removed" : "Saved"} ${n} link(s).`;
    },
  );

  tool(
    "ba_trace",
    "Traceability: impact of an item (mode impact, id), coverage gaps (coverage), a matrix (matrix, from/to types) or unlinked items (orphans).",
    { pending: "Tracing requirements", completed: "Traced requirements" },
    // A flat object, not a union by mode: agent clients flatten a top-level anyOf into untyped input.
    z.object({
      mode: z.enum(["impact", "coverage", "matrix", "orphans"]),
      id: z.string().optional().describe("impact: the item id"),
      depth: z.number().int().min(1).max(6).optional().describe("impact: link depth, default 3"),
      from: z.array(itemTypeSchema).optional().describe("matrix: row item types"),
      to: z.array(itemTypeSchema).optional().describe("matrix: column item types"),
    }),
    (args, session) => {
      const s = store.snapshot(session.projectId);
      switch (args.mode) {
        case "impact":
          if (args.id === undefined) return fail("ba_trace impact needs id.");
          return clip(traceImpact(s, args.id, args.depth ?? 3).markdown);
        case "coverage":
          return clip(traceCoverage(s).markdown);
        case "orphans":
          return clip(traceOrphans(s).markdown);
        case "matrix": {
          const m = traceMatrix(s, args.from, args.to);
          if (m.rows.length === 0) return "Nothing to trace yet.";
          const header = `| | ${m.columns.map((c) => c.id).join(" | ")} |`;
          const sep = `| --- | ${m.columns.map(() => "---").join(" | ")} |`;
          const rows = m.rows.map((r) => `| ${r.id} | ${m.columns.map((c) => (m.cells.some((x) => x.row === r.id && x.column === c.id) ? "●" : "")).join(" | ")} |`);
          return clip([header, sep, ...rows].join("\n"));
        }
      }
    },
  );

  tool(
    "ba_documents",
    "Without id: list the project's documents. With id: read a document (latest or the given version).",
    { pending: "Reading documents", completed: "Read documents" },
    z.object({ id: z.string().optional(), version: z.number().int().positive().optional(), kind: documentKindSchema.optional() }),
    ({ id, version, kind }, session) => {
      if (id === undefined) {
        const docs = store.listDocuments(session.projectId).filter((d) => kind === undefined || d.kind === kind);
        return docs.length === 0 ? "No documents yet." : docs.map((d) => `- \`${d.id}\` ${d.title} — ${d.kind}, v${d.version}, ${d.status}`).join("\n");
      }
      const doc = store.getDocument(session.projectId, id, version);
      return clip(`# ${doc.title} (\`${doc.id}\` v${doc.version}, ${doc.status})\n\n${doc.content}`, 60_000);
    },
  );

  tool(
    "ba_document_save",
    "Save a Markdown document as a new version (new document without id). Approve (status approved) only after the user explicitly confirmed in chat.",
    { pending: "Saving document", completed: "Saved document" },
    z.object({
      id: z.string().optional(),
      kind: documentKindSchema,
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(500_000),
      status: documentStatusSchema.optional(),
      note: z.string().max(500).optional(),
    }),
    (input, session) => {
      const doc = store.saveDocument(session.projectId, input, write(session));
      changed(session.projectId);
      return `Saved \`${doc.id}\` v${doc.version} (${doc.status}). The user can read it in the BA One Pass panel.`;
    },
  );

  tool(
    "ba_check_quality",
    "ISO/IEC/IEEE 29148 quality check of requirements, rules and criteria (scores 0–3 per characteristic, vague words EN/RU, set-level checks). record_issues=true creates VI issues for failures.",
    { pending: "Checking requirement quality", completed: "Checked requirement quality" },
    z.object({ ids: z.array(z.string()).max(200).optional(), types: z.array(itemTypeSchema).optional(), record_issues: z.boolean().optional() }),
    ({ ids, types, record_issues }, session) => {
      const s = store.snapshot(session.projectId);
      const report = checkQuality(s, { ids, types });
      if (record_issues === true) {
        const failing = report.results.flatMap((r) =>
          r.issues.map((issue) => ({
            type: "issue" as const,
            title: `${r.id}: ${issue.characteristic}`,
            body: issue.message,
            attrs: { characteristic: issue.characteristic, target: r.id },
            links: [{ to: r.id, relation: "impacts" as const }],
          })),
        );
        if (failing.length > 0) {
          store.upsertItems(session.projectId, failing.slice(0, 50), write(session, "ba_check_quality"));
          changed(session.projectId);
        }
      }
      return clip(report.markdown);
    },
  );

  tool(
    "ba_calc",
    "Deterministic BA calculations: prioritize (MoSCoW/WSJF/impact_effort/time_boxing), risk_matrix, compare_options, change_score, gap_summary. Parameters per method with examples: the ba-core skill, references/calc.md.",
    { pending: "Calculating", completed: "Calculated" },
    calcToolSchema,
    (raw, session) => {
      const checked = calcInputSchema.safeParse(raw);
      if (!checked.success) return fail(`ba_calc ${raw.method}: ${z.prettifyError(checked.error)}`);
      const input = checked.data;
      const s = store.snapshot(session.projectId);
      const result = runCalc(s, input);
      if (result.updates.length > 0) {
        store.upsertItems(
          session.projectId,
          result.updates.map((u) => {
            const item = s.items.find((i) => i.id === u.id);
            if (item === undefined) throw new StoreError(`ba_calc returned an unknown item ${u.id}.`);
            return { id: u.id, type: item.type, priority: u.priority, attrs: u.attrs };
          }),
          write(session, `ba_calc ${input.method}`),
        );
        changed(session.projectId);
      }
      return clip(result.markdown);
    },
  );

  tool(
    "ba_gate",
    "Readiness of a stage (default: this session's stage): which checks pass and which items fail. Gates warn, they do not block.",
    { pending: "Checking stage gate", completed: "Checked stage gate" },
    z.object({ stage: stageIdSchema.optional() }),
    ({ stage }, session) => {
      const gate = evaluateGate(store.snapshot(session.projectId), stage ?? session.stage);
      return [
        `Gate ${gate.stage}: ${gate.ready ? "READY" : "NOT READY"}`,
        ...gate.checks.map((c) => `- ${c.passed ? "✓" : c.blocking ? "✗ (blocking)" : "! "} ${c.detail}${c.items.length > 0 ? ` — ${c.items.join(", ")}` : ""}`),
      ].join("\n");
    },
  );

  tool(
    "ba_ask",
    "Ask the user 1–3 questions on one topic as a card in the chat and wait for the answers. Give each question a short why; mark exactly one option recommended when you have a hypothesis.",
    { pending: "Asking the user", completed: "User answered" },
    askPayloadSchema,
    async (payload, session, signal) => {
      // One open card per session: a new card closes the previous one, which
      // otherwise stays pending for 7 days after the user answered in chat.
      openAsks.get(session.threadId)?.abort();
      const own = new AbortController();
      openAsks.set(session.threadId, own);
      let result;
      try {
        result = await bb.ui.requestInput(
          {
            threadId: session.threadId,
            rendererId: ASK_RENDERER_ID,
            title: payload.title,
            payload,
            timeoutMs: 7 * 24 * 60 * 60 * 1000,
            presentation: { label: { pending: "Waiting for answers", completed: "Answered" }, icon: { glyph: "ba-one-pass/question" } },
            describeSubmission(value) {
              const parsed = askResponseSchema.safeParse(value);
              if (!parsed.success) return {};
              return {
                title: payload.title,
                detail: parsed.data.answers
                  .map((a) => {
                    const q = payload.questions.find((x) => x.id === a.id);
                    return `**${q?.question ?? a.id}**\n${a.status === "unknown" ? "_Не знаю / don't know_" : a.status === "skipped" ? "_—_" : a.answer}`;
                  })
                  .join("\n\n"),
              };
            },
          },
          { signal: AbortSignal.any([signal, own.signal]) },
        );
      } catch (error) {
        if (own.signal.aborted && !signal.aborted) return "This question card was replaced by a newer one; nothing to do.";
        throw error;
      } finally {
        if (openAsks.get(session.threadId) === own) openAsks.delete(session.threadId);
      }
      if (result.outcome === "cancelled" && own.signal.aborted) return "This question card was replaced by a newer one; nothing to do.";
      if (result.outcome === "cancelled") return `The user closed the question card (${result.reason}). Continue in chat without repeating the same card.`;
      const parsed = askResponseSchema.safeParse(result.value);
      if (!parsed.success) return fail("The answer card returned an unexpected value.");
      return parsed.data.answers
        .map((a) => {
          const q = payload.questions.find((x) => x.id === a.id);
          return `${a.id} [${a.status}] ${q?.question ?? ""}\n→ ${a.answer || "(no answer)"}`;
        })
        .join("\n\n");
    },
  );

  tool(
    "ba_stage_set",
    "Move the project to another stage. If the current stage gate is not ready, accept_risk (why we go on anyway) is required and goes to the decision log.",
    { pending: "Changing project stage", completed: "Changed project stage" },
    z.object({ stage: stageIdSchema, accept_risk: z.string().max(2000).optional() }),
    ({ stage, accept_risk }, session) => {
      const project = store.getProject(session.projectId);
      const gate = evaluateGate(store.snapshot(session.projectId), project.stage);
      if (!gate.ready && (accept_risk === undefined || accept_risk.trim() === "")) {
        return fail(
          `Gate of ${project.stage} is not ready:\n${gate.checks.filter((c) => !c.passed && c.blocking).map((c) => `- ${c.detail}`).join("\n")}\nAsk the user; pass accept_risk with their reason to go on.`,
        );
      }
      if (!gate.ready) {
        store.upsertItems(
          session.projectId,
          [
            {
              type: "decision",
              title: `Move from ${project.stage} to ${stage} with an unready gate`,
              body: accept_risk!,
              sources: [{ kind: "session", ref: session.threadId }],
            },
          ],
          write(session),
        );
      }
      store.updateProject(session.projectId, { stage });
      changed(session.projectId);
      return `Project stage is now ${stage}. Tools and skills of this session stay ${session.stage}; start a new ${stage} session from the panel to work in it.`;
    },
  );

  tool(
    "ba_session_close",
    "Close this session: save its summary and mark it closed. Call when the session goal is reached or the user ends it.",
    { pending: "Closing session", completed: "Closed session" },
    z.object({ summary: z.string().min(1).max(8000), next_step: z.string().max(2000).optional() }),
    ({ summary, next_step }, session) => {
      const content = `${summary.trim()}${next_step ? `\n\n## Next step\n\n${next_step.trim()}` : ""}`;
      store.saveDocument(session.projectId, { kind: "session_summary", title: `${session.title} — summary`, content }, write(session));
      store.closeSession(session.threadId, summary.trim().slice(0, 2000));
      changed(session.projectId);
      return "Session closed. The summary is saved in the project documents.";
    },
  );
}

const STAGE_TITLES: Record<StageId, string> = {
  plan: "Frame & plan",
  elicit: "Elicitation",
  strategy: "Strategy",
  requirements: "Requirements",
  lifecycle: "Life cycle",
  "one-pass": "One Pass",
};

const STAGE_TITLES_RU: Record<StageId, string> = {
  plan: "Рамка и план",
  elicit: "Выявление",
  strategy: "Стратегия",
  requirements: "Требования",
  lifecycle: "Жизненный цикл",
  "one-pass": "One Pass",
};

/** Thread title in the project's language (Russian for ru*, English otherwise). */
export function sessionTitle(projectName: string, stage: StageId, language = "en"): string {
  const titles = language.toLowerCase().startsWith("ru") ? STAGE_TITLES_RU : STAGE_TITLES;
  return `BA · ${projectName} · ${titles[stage]}`;
}

/** Names the stage's method skills so the agent opens them, not only ba-core. */
function stageSkillsLine(stage: StageId): string {
  const own = STAGES[stage].skills;
  const parts = [
    own.length > 0 ? `Stage skills: ${own.join(", ")}.` : "",
    `Life cycle skills (any stage): ${LIFECYCLE_SKILLS.join(", ")}.`,
    "Before each BABOK task (planning, an interview, current or future state, specifying, verifying, prioritising, approving…) load the skill for that task with the Skill tool and follow its steps; ba-core alone is not the method.",
  ];
  return parts.filter((part) => part !== "").join(" ");
}

/** Lines the configure callback adds for every BA session. */
export function sessionInstructions(session: Session, projectName: string, brief: string): string {
  return [
    "You are a business analyst assistant in a BA One Pass session (methodologist, secretary and controller; the human decides).",
    `BA project: ${JSON.stringify(projectName)} (id ${JSON.stringify(session.projectId)}). Session stage: ${session.stage}.`,
    brief,
    "Start with ba_context. Keep every register record in the ba_* tools, never as loose files. Follow the ba-core skill and the stage skills.",
    stageSkillsLine(session.stage),
    "Documents and register text go in the project language shown by ba_context.",
  ].join("\n");
}
