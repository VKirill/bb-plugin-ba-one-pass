---
name: ba-future-state
description: >-
  BABOK 6.2 — Define the future state: describe the 8 elements as they should
  be, set SMART business goals with KPIs, capture constraints, run the gap
  analysis against the current state and assess potential value. Use to
  describe the to-be and goals. RU: как должно быть, to-be, будущее состояние,
  цели, KPI, SMART, ограничения, gap-анализ, ценность.
---

# Define the future state (BABOK 6.2)

Where the organisation is heading. Outputs: the target state with SMART goals, and an
explicit gap analysis — the mandatory input for the change strategy (6.4). Goals give
the baseline to measure success; value here is context for 7.6.

Inputs (optional, degrade gracefully): current state items and needs from 6.1
(`ba_items` types state, cause, need), the BA plan, stakeholders.

## 1. Scope

Same elements as 6.1 or wider? Depth? Goals the sponsor already named? Record
`decision {topic: "future_state_scope", elements, depth, known_goals}`.

## 2. Describe the elements

Order: business needs (which will be satisfied) → capabilities → technology → others.
Show the current state of each element next to the target (from 6.1) and describe how it
should ultimately be, not "what to add". `ba_record` type `state`,
`attrs: {side: "future", element, target_metrics}`, links `satisfies` → needs.
Poor: "there will be a CRM" (a solution), "everything will be better". Details:
`references/future_state_guide.md`.

## 3. Goals and KPIs

`ba_record` type `goal`, `attrs: {kpi, baseline, target, deadline, smart: {...}}`, links
`derives_from` → needs. A goal without a measurable KPI is not a goal; help find one.
Check SMART and suggest improvements.

## 4. Constraints

`ba_record` type `constraint`, `attrs: {category: budget|time|technology|policy|resources|compliance|other,
certainty: known|assumed}`. Assumed constraints must be validated (they may be myths) —
add an `assumption` with an owner. Unknown constraints are risks.

## 5. Gap analysis

Run deliberately after the elements: `ba_calc` method `gap_summary` (parameters: tool schema and `ba-core` skill `references/calc.md`)
compares current and future elements. For each gap: `ba_record` type `gap`,
`attrs: {change_type: new|improve|eliminate|replace, complexity: low|medium|high}`, links
`derives_from` → its current and future `state` items (requirements will later link to the
gap with `addresses`). Without 6.1 the gap is described from the future only.

## 6. Potential value

Qualitative: benefits (type, magnitude, confidence, linked goals), investment level,
a one-line summary for the sponsor. Store in the goal `attrs.value` or the document.
Guide: `references/value_guide.md`.

## 7. Check and finish

`ba_gate` (warnings): elements described, at least one goal with KPI, needs linked to
goals, at least one constraint, gaps recorded, value assessed. Then
`ba_document_save` kind `future_state`. Next: risks (ba-risk-assessment) and change
strategy (ba-change-strategy). Requirements validation (7.3) reads these goals.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
