---
name: ba-elicitation-confirm
description: >-
  BABOK 4.3 — Confirm elicitation results: check the recorded facts for
  completeness, accuracy, consistency, unambiguity and testability, prepare
  targeted clarification questions, log the confirmed result for analysis. Use
  after processing interviews. RU: проверь заметки, противоречия, пробелы,
  уточняющие вопросы, закрыть 4.3, подтвердить результаты.
---

# Confirm elicitation results (BABOK 4.3)

Internal BA work, not a formal sign-off: find problems in the records while they are
cheap to fix. Do not invent; if unclear, ask one clarifying question.

How 4.3 differs from 4.2: 4.2 analyses what was said; 4.3 checks what was recorded. If a
new interview is needed, that is a return to 4.2.

If the user did not say, ask once: "Check the quality of the notes, or close out with
the stakeholder's answers?"

## Mode A — Quality check

Load facts, questions, conflicts and the interview notes (`ba_items`, `ba_documents`).
Check against the 5 criteria in `references/quality_criteria.md`:
completeness, accuracy (matches the speaker's words — compare with the quotes),
consistency (within and across sources), unambiguity (no vague wording without
measures), testability.

For each problem: criterion, severity (critical / significant / minor), the quote or ID,
a recommendation. New contradictions → `conflict` items; gaps → `question` items.
Readiness: ready for analysis / conditionally ready / needs rework.

## Mode B — Targeted clarification

Take only critical and significant problems. One short question each, with context
("At the meeting you said X. Did we understand correctly that…?") and options where
possible. Group by stakeholder. If the stakeholder is the user of this chat, ask with
`ba_ask`; otherwise produce the list to send.

## Mode C — Log the confirmed result

For each open problem record how it closed: clarified (update the fact, status
`confirmed`, add the answer as a source), dismissed (why), still open (keep the
question). Resolve conflicts (`status: resolved` + a `decision`).
Then `ba_document_save` kind `confirmed_results`: confirmed facts and rules, closed and
known issues, readiness. This is the input for strategy analysis (6.1, 6.3) and
requirements specification (7.1).

Finish with `ba_gate` for `elicit` and tell the user what remains.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
