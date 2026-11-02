---
name: ba-planning
description: >-
  BABOK ch. 3 — Business Analysis Planning and Monitoring: choose the BA approach,
  map stakeholders and their engagement, set governance (who decides, how changes
  and priorities are handled), plan information management and how BA performance
  is measured; finish with the ba_plan document. Use at the start of a project or
  when the plan must change. RU: как подойти к проекту, методология, кто
  стейкхолдеры, governance, согласования, как хранить требования, план анализа.
---

# Plan the business analysis (BABOK ch. 3)

Build the foundation the other stages read: approach, stakeholders, governance,
information management, performance measures. One task per step; do not flood the
user with questions — use `ba_ask` with a recommended option per question.

Later stages (elicitation, strategy, requirements, life cycle) read what you record here
through `ba_context` and `ba_documents`. Record decisions as `decision` items with
`attrs.topic` so they can be found: `approach`, `activities`, `governance`,
`information_management`, `performance`.

## 3.1 Plan the approach

Clarify only what the project data does not answer: how often requirements change,
how uncertain the work is, regulatory constraints.

| Situation | Approach |
| --- | --- |
| Stable requirements, low uncertainty | Predictive |
| High volatility or uncertainty | Adaptive |
| Need flexibility and control | Hybrid |
| Adaptive + strict compliance | Hybrid with compliance gates |

Record: `ba_record` decision `{topic: "approach", approach, rationale}`.
Optional 3.1b: BA activities and timing (phases for predictive, iterations for adaptive;
ask for hybrid, do not guess) → `decision {topic: "activities", periods: [...]}`.

## 3.2 Plan stakeholder engagement

The stakeholder register is living: at the start usually only the sponsor is known;
every interview adds people. For each stakeholder record (`ba_record` type
`stakeholder`): `attrs.role`, `influence` and `interest` (high/medium/low),
`attitude` (champion/neutral/blocker), `coverage` (identified/planned/not_covered),
`frequency` and `trigger` of communication (see `references/planning_guide.md`).

Ask in every interview: who do you coordinate changes with? who uses the results?
whose work changes? who could block it?

## 3.3 Plan governance

Who makes the final decision on requirements, how changes are handled (formal CR or
via product owner), escalation path, response deadline for approvers, prioritisation
technique, participants and criteria, project criticality.

Record `decision {topic: "governance", decision_makers: [roles], change_control,
escalation, response_days, prioritization: {method, participants, criteria},
criticality}`. Mark which values the user stated and which come from the default
template — the template is a default, not a verdict.

Governance is read later: life cycle skills (prioritise, change assessment, approval)
cross-check against it. Cross-checks warn, never override. Record roles here; people
are matched to roles through the stakeholder register, so do 3.2 first.

## 3.4 Plan information management

Where artifacts live (BA One Pass registers and documents; plus any team tools), the
traceability level (high: goals → requirements → tests; medium: requirements ↔
tickets; low: numbering), the level of detail per audience, reuse scope and the
attribute set (minimum / standard / full).
Record `decision {topic: "information_management", traceability, detail_by_audience,
reuse_scope, attributes}`.

## 3.5 Performance improvements

Look for warning signs (requirements change during development, developers complain
about unclear requirements, no single storage, slow onboarding, no quality metrics)
and agree how BA performance will be measured.
Record `decision {topic: "performance", measures, improvements}`.

## Finish

1. `ba_document_save` kind `ba_plan`: approach, activities, stakeholder map with the
   power/interest matrix, governance, information management, performance measures,
   open questions. Write it in the project language.
2. `ba_gate` for stage `plan`; tell the user what is missing.
3. Propose the next step (usually the elicitation stage) and `ba_session_close`.

Rules: nothing here is mandatory for later stages — a missing plan means later stages
just skip their cross-checks; but say so. Re-planning merges: update the existing
decision with a new one that `replaces` it.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
