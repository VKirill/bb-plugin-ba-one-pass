# BA One Pass — agent tools

Native BB tools available in every BA session (a thread spawned by the plugin with
`{ projectId, stage }` metadata). They replace the 114 MCP tools of AIналитик: the agent
reasons, the tools store and compute deterministically. Every tool knows the project from
the session; no tool takes a project id.

All register records live in the plugin database on the BB server, not in files. Never
write register data as loose Markdown files in the workspace; use these tools. The agent
may still read workspace files (product code, docs) as sources.

## IDs and records

- Register item IDs: `<PREFIX>-<n>`, assigned by the tool (`ST-1`, `F-12`, `BR-3`, `AC-7`).
  Prefixes: stakeholder ST, source SRC, fact F, question Q, assumption ASM, conflict CON,
  decision D, need BN, goal G, state SE, cause RC, gap GAP, constraint CN, risk R,
  requirement BR/SR/FR/NFR/TR (by `kind`: business/stakeholder/functional/nonfunctional/transition),
  rule RULE, scenario SC, criterion AC, option OPT, change CR, issue VI, term GL.
- Statuses per type: see `src/shared/model.ts` `ITEM_STATUSES` (first = default).
- `sources` is required when creating fact, requirement, rule, need, conflict. A source is
  `{ kind: session|document|item|file|url|person, ref, quote? }`. Put the verbatim quote when
  the record comes from text (transcript, document, user message).
- Type-specific details go to `attrs` (free JSON object, merged on update). Conventions:
  - stakeholder: `{ role, interest, influence: high|medium|low, attitude, raci }`
  - goal: `{ kpi, baseline, target, deadline, smart: {specific,measurable,achievable,relevant,timebound} }`
  - state: `{ side: current|future, category: process|people|technology|data|policy|other }`
  - risk: `{ probability: 1-5, impact: 1-5, category, response, owner }`
  - requirement: `{ rationale, fit_criterion, layer }`; priority goes to the `priority` field (must/should/could/wont)
  - scenario: `{ actor, trigger, main_flow: string[], alternatives: string[], exceptions: string[], result, format: scenario|use_case|user_story }`
  - criterion: `{ given, when, then }`
  - option: `{ approach: build|buy|configure|outsource|hybrid, cost, effort, scores: {criterion: number} }`
  - change: `{ requester, reason, urgency, effort, value }`
  - assumption: `{ risk_if_wrong, check_by }`; conflict: `{ sides: [{ref, claim}] }`; question: `{ ask: role, due }`
- `decision` items are append-only: never update a decision, add a new one that `replaces` it.

## Tools

| Tool | Parameters | Returns |
| --- | --- | --- |
| `ba_context` | `{ include?: ("summary"\|"plan"\|"stakeholders"\|"open"\|"gate"\|"documents"\|"sessions")[] }` | Markdown snapshot of the project for this session. Call it first in every session. Default include: summary, stakeholders, open, gate, documents. |
| `ba_items` | `{ ids?: string[], types?: ItemType[], status?: string[], query?: string, stage?: StageId, limit?: number (≤200), full?: boolean }` | Compact list (id, type, status, priority, title); `full: true` adds body, attrs, sources and links. |
| `ba_record` | `{ items: Array<{ id?, type, kind?, title, body?, status?, priority?, owner?, attrs?, sources?, links?: [{ to, relation, note? }] }>, note?: string }` (≤50) | Creates (no `id`) or updates (with `id`) items in one transaction; returns IDs, versions and warnings (missing source, unknown status, vague wording). Every update keeps the previous version in history. |
| `ba_link` | `{ links: [{ from, to, relation, note? }], remove?: boolean }` | Adds or removes traceability links. Relations: derives_from, satisfies, verifies, refines, depends_on, conflicts_with, mitigates, impacts, addresses, owned_by, sourced_from, replaces. |
| `ba_trace` | `{ mode: "impact", id, depth? }` \| `{ mode: "coverage" }` \| `{ mode: "matrix", from?: ItemType[], to?: ItemType[] }` \| `{ mode: "orphans" }` | Impact analysis (what depends on an item), coverage (goals→requirements→criteria, gaps), a traceability matrix in Markdown, or items without links. |
| `ba_documents` | `{ id?, version?, kind? }` | Without `id`: the list of project documents. With `id`: the document content (latest or given version). |
| `ba_document_save` | `{ id?, kind, title, content, status?: draft\|review\|approved, note? }` | Saves a Markdown document as a new version; returns id and version. Approving needs the user's explicit confirmation in chat first. |
| `ba_check_quality` | `{ ids?: string[], types?: ItemType[], record_issues?: boolean }` | ISO/IEC/IEEE 29148 check per requirement (necessary, unambiguous, singular, complete, feasible, verifiable, correct, conforming, traceable — score 0–3 each) plus vague-word lint (EN/RU), and set-level checks. `record_issues` creates VI items for failures. |
| `ba_calc` | `{ method: "prioritize", ... }` \| `{ method: "risk_matrix", ... }` \| `{ method: "compare_options", ... }` \| `{ method: "change_score", ... }` \| `{ method: "gap_summary" }` | Deterministic calculations. Exact parameters: `docs/calc.md`. |
| `ba_gate` | `{ stage?: StageId }` | Readiness of a stage: checks with passed/failed, failing item IDs. Gates warn; they never block. |
| `ba_ask` | `{ title, questions: [{ id, question, why?, options?: [{ label, description?, recommended? }], allow_free_text?: boolean, allow_unknown?: boolean }] }` (1–3 questions) | Shows a question card to the user and waits. Returns answers with status confirmed (picked the recommended option), overridden (another option or free text), unknown ("I don't know") or skipped. Mark exactly one option `recommended` when you have a hypothesis; say why in `description`. |
| `ba_stage_set` | `{ stage, accept_risk?: string }` | Moves the project to another stage. If the current gate is not ready, `accept_risk` (why we go on anyway) is required and is written to the decision log. |
| `ba_session_close` | `{ summary, next_step? }` | Closes this session: saves the summary (a `session_summary` document) and marks the session closed. Call it when the session goal is reached or the user ends the session. |

## Rules every skill follows

1. Start: `ba_context`. Do not ask the user what the project data or workspace already answers.
2. Reason first, then write: decide what to record, then one `ba_record` batch.
3. Every fact and requirement has a source; a guess is an `assumption` with an owner.
4. Report a conflict as soon as you see it: create a `conflict` item and tell the user.
5. Ask with `ba_ask`, at most 3 questions per card, each with *why* and, when possible, a recommended option.
6. One next step: end each reply with the single most useful next action.
7. Documents are written in the project language (`ba_context` shows it); these instructions stay English.
