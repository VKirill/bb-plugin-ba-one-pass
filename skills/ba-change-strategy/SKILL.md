---
name: ba-change-strategy
description: >-
  BABOK 6.4 — Define the change strategy: solution scope as capabilities with
  gap severity and explicit exclusions, enterprise readiness on six dimensions,
  strategy options (big bang, phased, pilot first, plus do nothing) compared
  with weighted criteria, and transition states by phase. Use after current
  state, future state and risks. RU: стратегия изменений, объём решения, scope,
  готовность организации, фазы внедрения, переходные состояния.
---

# Define the change strategy (BABOK 6.4)

The culmination of chapter 6: what we do, how, and in what order. Synthesises needs
(6.1), goals and gaps (6.2), risks and the recommendation (6.3) — load them with
`ba_items` and `ba_documents`. 6.4 defines WHAT (capabilities, scope) and WHEN (phases);
7.1 defines HOW.

## 1. Scope the strategy

Change type (transformation / process improvement / technology implementation /
regulatory / other), hard deadlines, methodology (from the BA plan if set), horizon in
months. Record `decision {topic: "change_strategy_scope", ...}`. Add the do-nothing
option right away: `ba_record` type `option`, title "Do nothing", `attrs.approach:
"do_nothing"` — BABOK requires justifying why inaction is worse.

## 2. Solution scope

Capabilities the organisation must have after the change and does not have now:
name, category (process / technology / data / people / org_structure / knowledge /
location), description, gap severity (your judgement — the gap analysis is context, not
a verdict), which gap it closes. Record them in the `change_strategy` document and link
gaps: for each, a `decision {topic: "solution_scope", capabilities, excluded, summary}`
plus links `addresses` → the gaps they close. List what is explicitly excluded —
deliberate decisions, not oversights. Report gaps no capability addresses.
Details: `references/change_strategy_guide.md` §3–4.

## 3. Enterprise readiness

Six dimensions 1–5 with rationale: leadership commitment, cultural readiness, resource
availability, operational readiness, technical readiness, change history. Average ≥ 4.0
ready; 2.5–3.9 proceed with caution; < 2.5 not ready (readiness programme first). Questions:
`references/readiness_guide.md` §6. A low score is a signal, not a cancellation: choose
pilot-first/phased or add a preparatory phase 0.

## 4. Strategy options

At least 2 real options + do nothing (3–4 is best). `ba_record` type `option`,
`attrs: {approach: big_bang|phased|pilot_first, investment: high|medium|low,
timeline_months, pros, cons}`, links `mitigates` → risks it reduces, `impacts` → risks it
worsens.

## 5. Compare

`ba_calc` method `compare_options` (parameters: tool schema and `ba-core` skill `references/calc.md`) with scores per criterion. Default
criteria and weights: alignment to goals 25, risk mitigation 20, cost 20, time to value 15,
readiness fit 10, feasibility 10 (override if the user wants). Mark the winner status
`recommended`, others `rejected` only after the user agrees. Write why the winner won with
concrete data, and the opportunity cost of what we give up.

## 6. Transition states

Per phase: name, duration, capabilities delivered, gaps closed, risks remaining, value
realised. Each phase must deliver standalone value. Big bang → 1 phase; phased → 2–5;
pilot first → pilot + rollout (+ scale). `ba_record` type `requirement` kind `transition`
for transition requirements the phases need.

## 7. Save

`ba_document_save` kind `change_strategy`: scope and exclusions, readiness, options and
comparison, chosen strategy and rationale, phases. Tell the user the strategy, why, and
what to do about the weakest readiness dimensions. Then `ba_gate` for `strategy`.
Next: requirements (7.1) per capability; design options (7.5) start from this strategy.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
