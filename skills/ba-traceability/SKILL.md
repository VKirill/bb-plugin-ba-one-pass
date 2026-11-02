---
name: ba-traceability
description: >-
  BABOK 5.1 — Trace requirements: link needs, goals, requirements, scenarios,
  criteria, options and risks into a graph; run impact analysis on a change;
  audit coverage before prioritisation or approval; produce a traceability
  matrix. Use whenever a requirement is added or changed. RU: трассировка,
  матрица трассировки, связи требований, анализ влияния, покрытие.
---

# Trace requirements (BABOK 5.1)

Traceability is a graph of links between all project items. When a requirement or a
change request arrives, the graph shows what is affected; without it, it is guesswork.

```
Business need / goal
  └─[derives_from]← Business requirement (BR)
       └─[derives_from]← Stakeholder requirement (SR)
            └─[derives_from]← Solution requirement (FR / NFR)
                 ├─[satisfies]← Option / component
                 └─[verifies]← Acceptance criterion (AC)
```

Horizontal: `depends_on` between requirements of the same level. Also `mitigates`
(→ risk), `addresses` (→ gap/cause), `owned_by` (→ stakeholder), `sourced_from`
(→ source). The graph always exists — no initialisation step. Links are created with
`ba_link` or inline through `links` in `ba_record`.

## Choose the formality first

If unknown, ask (`ba_ask`, recommend one): regulatory or audit → full; team > 20 →
standard → full; dedicated QA → standard; adaptive, small team → lite. Check the BA plan
traceability level (`ba_context` include `plan`) — use it unless the user states
otherwise. Presets: `references/traceability_guide.md`. The user decides.

## Mode A — New requirement

1. Type and kind (business / stakeholder / functional / nonfunctional / transition).
2. Where does it come from? → `derives_from` its parent (need, goal or higher requirement).
3. What does it depend on? → `depends_on`.
4. Which option or component implements it (if known)? → `satisfies`.
5. Which criterion verifies it (if known)? → criterion `verifies` requirement.
Missing `satisfies`/`verifies` early is normal. A requirement with no `derives_from` is
a problem.

## Mode B — A requirement changed

1. Update it (`ba_record` with id; history is kept automatically).
2. `ba_trace` mode `impact` on it — everything affected.
3. For each affected item: is the link still valid? Remove stale links
   (`ba_link` with `remove: true`), add new ones.
4. If it came as a change request → pass the impact to `ba-change-assess`.
Remind the user: "this requirement changed — its links need checking". This is the
main cause of dead traceability.

## Mode C — Coverage audit

Before prioritisation, before approval, after a series of changes: `ba_trace` mode
`coverage` and mode `orphans`.
- No source / no parent → clarify the business justification or freeze it.
- No implementation → check with the developer or add to the backlog.
- No acceptance criterion → behavioural requirements need one; models and rules are
  reviewed, not tested.
- Full coverage → ready for the next step.
Decide for each problem; for a report, `ba_trace` mode `matrix` and save
`ba_document_save` kind `traceability`.

## Where results go

Prioritisation (5.3) respects `depends_on`; change assessment (5.4) uses impact;
approval (5.5) includes the matrix; scenarios and stories trace to requirements.

5.1 does not prioritise (5.3), assess changes (5.4), approve (5.5) or create requirements
(4.x, 7.1).

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
