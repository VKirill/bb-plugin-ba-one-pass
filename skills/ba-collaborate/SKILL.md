---
name: ba-collaborate
description: >-
  BABOK 4.5 — Manage stakeholder collaboration: diagnose engagement signals,
  keep the decision log, write meeting minutes, analyse a stakeholder conflict
  and plan its resolution. Use when a stakeholder goes silent or resists, a
  decision was made, or after a meeting. RU: стейкхолдер замолчал, против,
  конфликт, лог решений, протокол встречи, зафиксируй решение.
---

# Manage stakeholder collaboration (BABOK 4.5)

The most human task of chapter 4: relationships, trust, politics. You do not replace
the analyst in negotiations; you diagnose, structure, log and suggest a strategy. Do not
invent motives; work only with what the user described; if information is missing, ask
one question.

If the user did not say, ask once: "Understand what is happening with a stakeholder, log
a decision or minutes, or resolve a conflict?"

## Mode A — Engagement diagnosis

Input: the behaviour + the stakeholder's profile (`ba_items` id). Use
`references/engagement_signals.md`:
1. Classify the signal: positive / warning / negative.
2. Interpret it against influence, interest, attitude.
3. Name 2–3 probable causes, a concrete tactic for each.
4. If the attitude changed: `ba_record` the stakeholder with `attrs.attitude` and
   `attrs.engagement_history` entry `{date, before, after, cause, action}`.

## Mode B — Decision log

Decisions answer "why was this decided" three months later.
1. State the decision in one sentence.
2. Context: what was discussed, alternatives considered.
3. Who decided, who was involved (check against governance decision makers from the BA
   plan; if someone else decided, say so — warn, don't block).
4. Impact: which items it affects.
5. `ba_record` type `decision` (append-only) with `links` `impacts` to affected items.

## Mode C — Meeting minutes

Participants and roles, agenda, key points, decisions, action items (action + owner +
deadline), open questions, risks. Save `ba_document_save` kind `meeting_notes`; record
decisions (Mode B), action items and open questions as `question` items with owners,
risks as `risk` items.

## Mode D — Conflict

Use `references/engagement_signals.md`:
1. Type: priority / resource / conceptual / territorial / personal.
2. Parties and their real interests (not positions).
3. The common goal.
4. A resolution strategy with steps; the BA's role: facilitator / escalation / observer.
5. Record a `conflict` item (`attrs.sides`), and a `decision` when resolved.
The BA is a facilitator, not a judge. Personal conflicts → escalate to the manager/HR.

## Related tasks

| Event | Here | Updates |
|---|---|---|
| Attitude changed | Mode A | stakeholder attrs + history |
| Decision on requirements | Mode B | decision item |
| Meeting held | Mode C | meeting_notes document |
| Conflict does not resolve | escalate, log in minutes | risk item |
| New stakeholder | `ba_record` stakeholder (as in 4.2) | register |

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
