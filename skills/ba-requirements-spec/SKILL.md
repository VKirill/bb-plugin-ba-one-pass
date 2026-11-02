---
name: ba-requirements-spec
description: >-
  BABOK 7.1 — Specify and model requirements: turn confirmed elicitation
  results into business, stakeholder, functional and non-functional
  requirements, business rules, user stories, use cases, process models, data
  dictionary and ER models, each linked to the goal it serves, then check goal
  coverage. Use to write requirements. RU: оформи требования, user story, use
  case, BPMN, бизнес-правила, спецификация, ТЗ.
---

# Specify and model requirements (BABOK 7.1)

The bridge from "what stakeholders said" to "requirements in standard notations with
models". Inputs: confirmed results (4.3 document `confirmed_results`), facts, needs and
goals (6.1/6.2), the change strategy and solution scope (6.4) — load with `ba_items`
and `ba_documents`.

## 1. Analyse the context

Read the confirmed results and facts; propose candidate requirements with a type and
kind, and list elicitation topics that still have no requirement (gaps → `question`).

## 2. Create the items

Choose the artifact type with `references/modeling_guide.md`; templates in
`references/templates.md`. Create in batches with `ba_record` — status `draft`, a
source (the fact, document or person), and links:

| Artifact | Record |
| --- | --- |
| Business / stakeholder requirement | `requirement` kind business / stakeholder |
| Functional: "The system SHALL [action]…" | `requirement` kind functional |
| Non-functional with a measure: "…at least N requests per second under [condition]" | `requirement` kind nonfunctional |
| Business rule (no reference to the system) | `rule` |
| User story / use case / scenario | `scenario`, `attrs.format` user_story / use_case / scenario, `actor`, `trigger`, `main_flow`, `alternatives`, `exceptions`, `result`; use cases also pre/postconditions |
| Acceptance criterion | `criterion`, `attrs: {given, when, then}`, link `verifies` → its requirement or scenario |
| Data entity / glossary term | `term`, `attrs.attributes` |
| Transition requirement | `requirement` kind transition |

Link each requirement to the goal it serves (`satisfies` → `G-n`) and to its parent
(`derives_from` → need or higher requirement). Ask which goal a requirement serves —
never guess it from wording. Supporting models (data, ER) usually stay unlinked to goals.

## 3. Models and diagrams

Write models into the `requirements_spec` document as Mermaid: `flowchart` for business
processes (participants as lanes or prefixes), `erDiagram` for entities and relations, a
use case overview as a `flowchart` with actors. Keep the diagrams consistent with the
records.

## 4. Coverage

`ba_trace` mode `coverage`: goals with no requirement (red), 1–9 requirements (normal),
10+ on one goal (possible over-engineering — check duplicates), requirements linked to no
goal, requirements traced to a need but no goal (a need not yet refined into goals).
Nothing is inferred from wording — only declared links count.

## 5. Save

`ba_document_save` kind `requirements_spec` (project language): requirements by kind,
rules, scenarios with criteria, models, glossary, coverage. Next: verify (7.2), validate
(7.3), prioritise (5.3).

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
