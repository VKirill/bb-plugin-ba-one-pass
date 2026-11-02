---
name: ba-prioritize
description: >-
  BABOK 5.3 — Prioritise requirements and designs with MoSCoW, WSJF,
  Impact/Effort or Time Boxing: collect each stakeholder's scores, aggregate
  with influence weights, find conflicts and dependency violations, resolve
  them and record final priorities. Use before a release or sprint, after
  estimates or a change request. RU: приоритизация, MoSCoW, WSJF, что важнее,
  что войдёт в релиз, приоритеты.
---

# Prioritise requirements (BABOK 5.3)

A continuous process, not a one-off. You structure it; stakeholders decide.

Inputs: requirements (`ba_items` types requirement, scenario), `depends_on` links
(5.1), stability = version history (5.2), the stakeholder register with influence
(3.2/4.2), governance from the BA plan — prioritisation method, participants, criteria,
who decides conflicts (`ba_context` include `plan`).

## Methods (details: `references/methods_guide.md`)

- **MoSCoW** — Must / Should / Could / Won't. Fast, clear; ignores cost and time.
- **WSJF** — (business value + time criticality + risk reduction) ÷ job size. Needs
  developer estimates.
- **Impact/Effort** — value vs effort, 4 quadrants mapped to priorities. Good for workshops.
- **Time Boxing** — fixed capacity (team throughput or budget) filled by value; what does
  not fit becomes Won't (this time). Needs a cost per requirement.

Choose: no estimates → MoSCoW or Impact/Effort; estimates + adaptive → WSJF; fixed
deadline or budget → Time Boxing; Must inflation after a first pass → Time Boxing as a
second pass. If the BA plan names another method, say so; the user decides.

## Pipeline

1. **Open.** Scope (which requirements), method, scale (WSJF: Fibonacci or 1–10 with a
   reference requirement; Impact/Effort: quadrant mapping; Time Boxing: capacity and
   unit). Flag volatile requirements (many versions) and Must candidates with
   dependencies.
2. **Collect scores** per stakeholder individually (`ba_ask` if the stakeholder is the
   user; otherwise from what the user brings). A second round from the same person
   replaces the first.
3. **Aggregate** with `ba_calc` method `prioritize` — parameters: tool schema and `ba-core` skill `references/calc.md`.
   Review: final priority per requirement, stakeholder conflicts, dependency violations
   (a Must/Should depends on something lower — only `depends_on` counts), volatile
   requirements at high priority. More than 60% Must = Must inflation → suggest a Time
   Boxing pass.
4. **Resolve conflicts** with tactics from `references/conflict_resolution.md`. Record
   each resolution as a `decision` (who decided — cross-check with governance; warn,
   don't block). Critical conflicts (Must vs Won't, high-influence stakeholders) are
   logged with links `impacts` to the requirements.
5. **Finalise.** Write priorities: `ba_record` the requirements with `priority`
   (and `attrs.wsjf_score` for WSJF). `ba_document_save` kind `prioritization`: method,
   participants, scores summary, conflicts and resolutions, final list.

Designs (scenarios, models) are prioritised with the same scheme.
Repeat whenever estimates arrive, a change request is approved or the context changes.

5.3 does not create requirements, approve them (5.5) or assess changes (5.4).

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
