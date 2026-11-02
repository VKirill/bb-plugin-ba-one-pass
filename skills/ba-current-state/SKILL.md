---
name: ba-current-state
description: >-
  BABOK 6.1 — Analyse the current state: scope the analysis, describe the 8
  elements (business needs, organisation, capabilities and processes,
  technology, policies, architecture, assets, external influences), run root
  cause analysis (5 whys, fishbone, problem tree) and define business needs.
  Use to describe the problem and the as-is. RU: как сейчас, as-is, текущее
  состояние, проблема, корневая причина, бизнес-потребность.
---

# Analyse the current state (BABOK 6.1)

The starting point of the change. Two outputs: a structured description of what exists
now, and business needs (BN) — the upstream nodes of traceability
(BN → goal → BR → FR → AC). RCA separates symptoms from causes.

Inputs: confirmed elicitation results (4.3), facts and sources (`ba_items` types fact,
source, conflict), the BA plan and stakeholders (`ba_context` include `plan`). Import
what elicitation already established instead of asking again; imported content starts
as `draft`.

## 1. Scope (first)

Ask only what you cannot see: what triggered the project (process improvement / new
system / regulatory / cost reduction / market opportunity), time available (depth:
light / standard / deep). Default elements by trigger:

- process improvement → business needs, capabilities, technology, policies
- new system → business needs, capabilities, technology, architecture
- regulatory → business needs, policies, technology, external
- cost reduction → business needs, capabilities, assets, external
- market opportunity → all 8, deep

Record `decision {topic: "current_state_scope", trigger, depth, elements}`. Better deep on
4 elements than shallow on 8.

## 2. Describe the elements

Order: business needs → capabilities and technology (where the problem shows) →
policies (what blocks or is required) → the rest as needed. Questions per element:
`references/current_state_guide.md`.

Each element → `ba_record` type `state`, `attrs: {side: "current", element, metrics,
pain_points}`, with sources. Good: numbers (time, money, frequency, error rate), pain
points, clear sources. Poor: "the process is inefficient", "no automation" (a symptom).

## 3. Root cause analysis

Per key problem (`references/rca_guide.md`): five whys (one linear problem), fishbone
(several cause categories), problem tree (strategic). Measurable problem statement; one
root cause (not a symptom); contributing factors; evidence; affected elements.
`ba_record` type `cause`, `attrs: {problem_statement, technique, contributing_factors,
evidence}`, links `impacts` → affected `state` items.

## 4. Business needs

Need = WHAT must change and WHY; a requirement = HOW. `ba_record` type `need`:
title, measurable description, `attrs: {cost_of_inaction, expected_benefits}`, sources,
links `addresses` → its root causes (mandatory).
"We need a CRM" is a solution; the need is "we lose 30% of customers to slow handling".

## 5. Check and finish

`ba_gate` for `strategy` (warnings, not blockers): elements in scope described, at least
one RCA, needs exist and link to causes. Then `ba_document_save` kind `current_state`
(project language): scope, elements with metrics, RCA, needs, open questions.
Next: the future state (ba-future-state).

## Typical mistakes

Symptoms instead of causes (ask "why?" 3–5 times); analysing everything (hold the
scope); a need phrased as a solution; no numbers (value cannot be assessed later — help
find or estimate metrics).

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
