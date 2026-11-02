---
name: ba-one-pass
description: >-
  One-pass business analysis of a new feature or a change to an existing
  product, in one continuous session: research docs, code and rules first, run
  an adaptive interview, keep registers of facts, gaps, conflicts and
  assumptions, write testable requirements with acceptance criteria, check
  quality (ISO 29148 / BABOK / RUP Vision) and agree a BRPV (Business
  Requirements & Product Vision) document for the system analyst or architect.
  RU: бизнес-анализ за один проход, бизнес-требования, BRD, BRPV, видение
  продукта, ТЗ на фичу.
---

# BA One Pass — the whole analysis in one session

Turn a raw idea into an agreed BRPV document so that a system analyst, architect or
coding agent can work without re-interviewing the customer. Describe **what** and **why**,
not **how**. Announce each stage in one short line; the user does not launch stages.

## 1. Frame (one reply)

`ba_context`. Restate: what changes, for whom, type (new feature / change to an existing
one), expected size. If the object itself is unclear, ask one question; otherwise go on.

## 2. Research before asking

Collect what you can learn without the person; record each finding as a `fact` with a
`file` / `url` / `document` source:
- project docs: README, design docs, decisions;
- product code: current behaviour, entities, roles, limits, UI texts (use GitNexus if the
  repository is indexed);
- business rules in code and configs: validations, tariffs, rights, statuses, deadlines;
- external sources when useful and the project is not sensitive: competitors, platform
  rules, law (personal data, payments, moderation).
Tell the user "what I already know" and "my hypotheses" (record hypotheses as
`assumption` items). Do not ask what you found yourself.

## 3. Adaptive interview

Follow the `ba-interview` skill: `ba_ask` cards, ≤ 3 questions on one topic, reverse
interview, a recommended option with its source, "don't know" → default + assumption. Pick
the next topic by the emptiest BRPV section with the highest risk. Stop when every
mandatory section of the template has content or an explicit "out of scope / open question
with an owner" and no critical conflict is open; if the user stops earlier, move gaps to
open questions.

## 4. Registers as you go

`ba_record` in batches: `stakeholder`, `fact`, `question` (Q), `assumption` (ASM, with
owner and risk), `conflict` (CON — tell the user immediately), `goal` (G, with KPI),
`constraint`, `risk`, `decision`. Every record ends one way: resolved (link to the
answer), accepted as an assumption, or an open question.

## 5. Requirements

- Business requirement: `requirement` kind business — one idea, "must", no
  implementation ("The client must see the order status without calling a manager", not
  "add WebSocket"). Link `satisfies` → goal.
- Stakeholder/user requirements: kind stakeholder, linked `derives_from` → BR and to the
  scenario.
- Business rules: `rule`, separate from requirements.
- Scenarios: `scenario` with main path, alternatives, exceptions.
- Acceptance criteria: `criterion` `{given, when, then}`, `verifies` → its requirement.
- Priority MoSCoW in `priority`.
- Words without a measure ("fast", "convenient", "a lot", "etc.", "if necessary") →
  replace with a number or open a `question`.

## 6. Quality gate before showing

`ba_check_quality` on all requirements; `ba_trace` mode `coverage` (goal → requirement →
criterion, no empty cells for Must). Go through `references/quality-checklist.md`. Fix
what you can; the rest becomes open questions. Show a short result: how many requirements,
how many with criteria, open questions, uncovered goals. If the check fails, the document
status stays draft and you say why.

## 7. BRPV, agreement, handoff

1. Build the document from the registers with `references/brpv-template.md` (the template is in Russian: for another project
   language translate the headings; template comments are hints, not content) and `ba_document_save` kind
   `brpv`, status `draft`.
2. Show a one-screen summary: problem, goal with metric, scope, Must requirements, risks,
   open questions. Ask to confirm or correct; apply corrections as a new version.
3. After explicit confirmation: status `approved`, date and who agreed (record a
   `decision`).
4. Fill "Handoff": what to read first, what is decided and not up for discussion, what is
   left for system analysis and architecture. Then `ba_session_close`.

## Do not

Ask what docs or code already answer; dump 20 questions at once; design APIs, schemas,
screens or the stack; hide uncertainty; invent metric numbers.

Methodology: BABOK v3 (elicitation, strategy analysis, requirements analysis), RUP Vision
(problem statement, positioning, stakeholders), ISO/IEC/IEEE 29148 (requirement and set
quality). Requirement statuses and tools are shared with the full-path stages, so a One Pass
project can continue in the detailed stages later.
