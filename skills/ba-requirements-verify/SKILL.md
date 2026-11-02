---
name: ba-requirements-verify
description: >-
  BABOK 7.2 — Verify requirements: check wording quality (atomic, unambiguous,
  testable, prioritised, concise, consistent, complete, feasible,
  understandable; scored with ISO/IEC/IEEE 29148 characteristics), check model
  consistency, record and resolve verification issues, mark requirements
  verified, produce the verification report. Use before validation and
  approval. RU: проверь качество требований, чек-лист, верификация,
  формулировки, размытые слова.
---

# Verify requirements (BABOK 7.2)

"Is the requirement written correctly?" — not "is it the right requirement?" (that is
7.3). Input: draft requirements, rules, scenarios, criteria. Output: `verified` status and
the verification report for 7.3 and 5.5. Rules: `references/quality_rules.md`; checklists
by type: `references/checklist_templates.md`.

## Characteristics

Automatic (`ba_check_quality`, scores 0–3 per ISO/IEC/IEEE 29148 characteristic plus a
vague-word lint in English and Russian): atomic/singular, unambiguous, testable/verifiable,
prioritised, concise, consistent, complete, traceable. Manual (your checklist with the
user): feasible, understandable.

## Pipeline

1. `ba_check_quality` — all drafts, or `ids` / `types`. Explain each problem in plain
   words and propose a fix:
   - vague word → a rewording with a measure ("fast" → "within 2 s at up to 1,000 users");
   - no acceptance criterion → 2–3 criteria in Given/When/Then;
   - not atomic → where a conjunction splits it; propose two requirements;
   - not testable → ask for the measurable outcome.
2. Record problems with `record_issues: true` or `ba_record` type `issue`,
   `attrs: {issue_type: ambiguity|not_testable|not_atomic|missing_ac|model_inconsistency|other,
   severity: blocker|major|minor}`, link `impacts` → the requirement, `owner` = who fixes it.
3. Fix the requirements with the user (`ba_record` with id).
4. Model consistency: `ba_trace` mode `orphans`; compare the requirements_spec diagrams
   with the records (entities vs glossary terms, use cases vs actors, process participants
   vs actors). Mismatches → `issue` model_inconsistency.
5. Group C checklists (feasibility, understandability) from
   `references/checklist_templates.md`.
6. Close fixed issues (`status: resolved`, `note` says what changed). Never close an
   unresolved issue just to move on.
7. Mark verified: `ba_record` status `verified` for requirements without open blockers. If
   the user accepts a blocker, verify anyway with `note` naming the overridden issue and
   record a `decision` — honest and auditable; the issue stays open.
8. `ba_document_save` kind `verification_report`: % verified, top problems by
   characteristic, requirements with open blockers, overrides, verdict for approval.

7.2 and 7.3 can run iteratively; if validation finds bad wording, return here.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
