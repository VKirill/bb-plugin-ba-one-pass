---
name: ba-communicate
description: >-
  BABOK 4.4 — Communicate business analysis information: adapt an artifact for
  an audience (sponsor, manager, developer, architect, tester), choose format and
  channel, log that it was delivered and understood, check whom to contact now.
  Use when sharing results. RU: адаптируй для разработчиков, для руководства,
  как донести, формат, канал, кому написать, зафиксируй отправку.
---

# Communicate BA information (BABOK 4.4)

Communicating is not sending a file: the goal is shared understanding. Adapt the
form, never the content; do not invent. Inputs: a document or items (`ba_documents`,
`ba_items`), the stakeholder register and the BA plan (detail level per audience, from
`ba_context` include `plan`).

If the user did not say, ask once: "Check whom to contact now, adapt an artifact for an
audience, choose a format, or log a communication you made?"

## Mode A — Adapt for an audience

1. Identify the audience; apply `references/audience_guide.md`.
2. Strip noise for this audience, keep the meaning.
3. Rephrase in their language; add what matters to this role.
4. Attitude `blocker` → add "Why this matters to you".
5. If the BA plan sets a detail level for this audience, follow it and say so.
6. `ba_document_save` kind `comm_package` (title names the audience).

## Mode B — Format and channel

Assess maturity (raw / structured / confirmed) and whether discussion is needed; use the
matrix in `references/audience_guide.md`. Rules: blocker → 1-on-1 meeting, not email;
high influence + low interest → executive summary; several audiences at once → a group
meeting only with a shared context.

## Mode C — Log a communication

Who / what / when / channel / understanding (understood, partially, not understood, no
response) / follow-ups. Record a `decision` item with `attrs.topic: "communication"`,
`attrs: {channel, date, participants, artifact, understanding}`; update the
stakeholder's `attrs.last_contact`. Follow-ups → `question` items with an owner.

## Mode D — Communication schedule

For each stakeholder compare `attrs.last_contact` with `attrs.frequency` (set in
planning). Stakeholders with no frequency are not evaluated — name them; claim "on
track" only for those checked. Check triggers (new decision, requirement change, end of
an elicitation session). Output a prioritised contact list in chat.

## What 4.4 does not do

No new requirements (4.2/4.3), no formal approval (5.5), no conflict management (4.5),
no content changes. A stakeholder who wants different requirements after delivery
raises a change request (ba-change-assess).

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
