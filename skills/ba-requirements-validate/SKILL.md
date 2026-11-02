---
name: ba-requirements-validate
description: >-
  BABOK 7.3 — Validate requirements: check that each requirement brings value,
  serves a business goal and the future state, set success criteria for
  critical ones, log and resolve assumptions, mark requirements validated and
  produce the validation report. Use after verification. RU: нужны ли
  требования бизнесу, соответствие целям, допущения, валидация, критерии успеха.
---

# Validate requirements (BABOK 7.3)

"Did we write the right requirements?" A perfectly worded requirement can still be
useless. Iterative: run it several times during the project.
Methodology: `references/validation_guide.md`; assumptions:
`references/assumptions_guide.md`.

## Three axes

1. **Value** — each requirement traces to a business goal; an orphan is a candidate for
   removal or decomposition.
2. **Alignment with the future state** — it helps reach the to-be from 6.2.
3. **Assumptions and risks** — contestable assumptions are logged; open high-risk ones
   warn against validation.

## Pipeline

1. **Business context.** `ba_context` and `ba_items` types goal, need, state (future),
   plus the change strategy document (scope and exclusions). Goals come from 6.2; if
   there are none, agree them with the user now (`ba_record` type goal).
2. **Alignment.** `ba_trace` mode `coverage` for verified requirements: aligned (traced
   to a goal through the graph), orphan (no business justification), goals not covered.
   Do not infer alignment from similar words — if you see a likely link, propose it and
   add it with `ba_link` after the user agrees.
3. **Success criteria** (optional, critical requirements): `attrs.success_criteria:
   {baseline, target, measurement_method, goal}`; show the goal's KPI as a reference.
   These feed solution evaluation later.
4. **Assumptions** as they appear: `ba_record` type `assumption`,
   `attrs: {risk_level: high|medium|low, risk_if_wrong, check_by}`, `owner`, links
   `impacts` → affected requirements.
5. **Resolve assumptions** after an interview, pilot or analysis: status `confirmed` or
   `invalidated` with the evidence in `note`. Invalidated → list the affected
   requirements for re-examination; a new elicitation round may be needed.
6. **Mark validated**: `ba_record` status `validated`. Preconditions are warnings: status
   `verified`, no open high-risk assumption, traced to a goal. Overriding a warning needs
   the user's explicit OK, recorded as a `decision`.
7. **Report**: `ba_document_save` kind `validation_report` — % validated, goal coverage,
   orphans, open assumptions by risk, % with success criteria, verdict for design options
   (7.5).

Lifecycle: draft → verified (7.2) → validated (7.3) → approved (5.5).

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
