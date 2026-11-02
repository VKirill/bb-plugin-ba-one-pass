---
name: ba-approve
description: >-
  BABOK 5.5 — Approve requirements: assemble an approval package for an
  audience, record each stakeholder's decision (approved, conditional,
  rejected, abstained), close conditions, check readiness and create a
  requirements baseline. Use before handing requirements to development. RU:
  утвердить требования, согласование, sign-off, базовая версия, baseline.
---

# Approve requirements (BABOK 5.5)

Formal sign-off. Approval is always the human's decision: set `approved` only after the
stakeholder's explicit answer in chat (or one the user reports, with who and when).
Details: `references/approval_guide.md`.

Inputs: verified requirements (7.2) — unverified ones are reported, not blocked;
traceability (5.1), versions (5.2), priorities (5.3), change decisions (5.4), stakeholders
with RACI, governance decision makers and response deadline, the BA plan approach
(predictive → formal per-requirement decisions; adaptive → sprint planning; plain hybrid
→ ask).

## Pipeline

1. **Package.** `ba_items` the requirements in scope with their criteria; build the
   package for the audience (business / developer / regulator / all): statements,
   acceptance criteria, traceability matrix (`ba_trace` matrix), priorities, change
   decisions, decision makers, deadline. Warn about unverified requirements.
   `ba_document_save` kind `approval_package`.
2. **Record decisions**, once per stakeholder: approved / conditional / rejected /
   abstained, per requirement or for the whole package. A `decision` item each,
   `attrs: {stakeholder, raci, decision, conditions: [{req, text, deadline, owner}],
   rejection_reason}`, linked `impacts` to the requirements. Rejected → look for
   conflicts with priorities (5.3) and changes (5.4).
3. **Close conditions** when satisfied: a new `decision` that `replaces` the conditional one.
4. **Check readiness:** counts by decision, overdue conditions, missing answers,
   rejections by accountable stakeholders (blockers). Consulted rejection → document the
   risk, baseline still possible; accountable rejection → resolve first (change the
   requirement via 5.2 or open a CR via 5.4, then re-approve).
5. **Baseline:** `ba_record` approved requirements with status `approved`;
   `ba_document_save` kind `baseline` with the version (`v1.0`, `sprint-5`), who
   confirmed, the list with versions, open warnings. With warnings, proceed only on the
   user's explicit "go ahead", recorded as a `decision`.

Scenarios: predictive — baseline at the end of a phase; adaptive — sprint backlog
baseline approved by the product owner; conflict — see step 4.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
