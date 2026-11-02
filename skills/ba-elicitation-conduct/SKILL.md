---
name: ba-elicitation-conduct
description: >-
  BABOK 4.2 — Conduct elicitation / process its results: turn a transcript,
  notes or workshop record into facts with sources, stakeholder updates,
  questions, risks and conflicts; compare several interviews; re-elicit after a
  change request. Use when the user brings a transcript, notes or answers. RU:
  вот транскрипт, разбери интервью, что упустили, сравни интервью, пришёл CR.
---

# Conduct elicitation and process results (BABOK 4.2)

You analyse elicitation material and help the analyst get the most from it. Do not
invent anything that is not in the material; if information is missing, say so as an
analytical note and create a `question`.

Inputs: an attached file, pasted text, or a workspace path. First record the input as a
`source` item (`ba_record` type `source`, `attrs: {kind: transcript|notes|survey|document,
participants, date}`) so every fact can cite it.

## Pick the scenario

If the user did not say, ask once: "Is this the first session on this topic, or are
there earlier results? Is it planned elicitation or a reaction to a change?"

### A — One interview / workshop / notes

`references/single_interview.md`. In short: transcript → structured profile → gaps →
recommendations → records.

### B — Several sessions

`references/multi_interview.md`: compare profiles → contradictions → gaps → who and
what to re-elicit. Use `ba_items` to load earlier facts.

### C — Change request

`references/change_request_elicitation.md`: CR → affected requirements (`ba_trace`
mode impact) → what is outdated → who to re-elicit → what exactly to ask.

## Record the results

One `ba_record` batch after you have decided what to write:

- `fact` — each statement, with `sources: [{kind: "item", ref: "<SRC id>", quote}]`
  (verbatim quote), `owner` = who said it.
- `stakeholder` — new people mentioned; update influence/interest/attitude.
- `question` — gaps, with `attrs.ask` (role) and why it matters.
- `conflict` — contradictions between people or sources, `attrs.sides`.
- `assumption` — what the speaker took for granted; `risk` — risks mentioned.

Then `ba_document_save` kind `interview_notes`: session, participants, key points,
pains, rules, gaps, follow-ups, with item IDs. Tell the user about conflicts right away.

Next: confirm the results with `ba-elicitation-confirm` (4.3).

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
