---
name: ba-interview
description: >-
  Run a live adaptive stakeholder interview in the chat with ba_ask cards:
  research first, reverse interview ("I understand X — correct?"), one topic per
  card with up to 3 questions, a recommended option with its source, "don't
  know" handled as a default plus an assumption, a coverage map and a stop
  criterion. Records facts with quotes. Use when the user is the stakeholder to
  interview. RU: проведи интервью, опроси меня, задай вопросы, выявление
  требований в чате.
---

# Live adaptive interview

The user of this chat is the stakeholder. The goal: the most information per minute of
their time, with every answer recorded as a sourced fact.

## Before the first question

1. `ba_context` and `ba_items`: what is already known (facts, questions, conflicts, the BA
   plan, stakeholders).
2. Research what you can without the person: workspace docs and code (business rules,
   statuses, limits, texts), earlier documents, public sources if the project is not
   sensitive. Record what you found as `fact` items with `file`/`url` sources.
3. Tell the user in 3–6 lines: what you already know, your main hypotheses, what you will
   ask about. Do not ask what you found yourself.

## Coverage map

Track silently; show on request. Pick the next topic by the largest gap × risk.

| Topic | Key question |
| --- | --- |
| Problem | Who suffers now, in what situation, at what cost? |
| Goals and metrics | What changes for the business; how do we know it worked (number, date)? |
| Stakeholders | Who uses, pays, decides, will be affected? |
| As-is | How is it done now, including workarounds? |
| Scope | What is surely in, surely out of this release? |
| Scenarios | Main path, alternatives, errors and exceptions |
| Rules | Calculations, statuses, rights, limits, deadlines |
| Data | Which entities appear or change, where from, who owns them |
| Constraints | Time, budget, platform, law, compatibility |
| Quality | Speed, volume, availability, languages, security — with numbers |
| Acceptance | What will be shown to accept the work? |

## Asking

- One topic per `ba_ask` card, at most 3 questions.
- Prefer the **reverse interview**: "I understand that refunds are possible within 14
  days — correct?" with options; correcting a hypothesis is easier than formulating from
  scratch.
- Each question: `why` (which part of the analysis or which risk it closes); options where
  sensible; exactly one `recommended` option when you have a hypothesis, its source in the
  `description` ("from the public offer, section 5"); `allow_unknown: true`.
- Adapt the level to the person: owner — goals, money, users; specialist — rules, data,
  integrations.

## Answers

| Status | What to do |
| --- | --- |
| confirmed | `fact` (status `confirmed`) with `sources: [{kind: "person", ref: "<ST id or the user>", quote}]` |
| overridden | `fact` with the user's version; if it contradicts a document or code, a `conflict` — tell the user now |
| unknown | propose a sensible default, record it as an `assumption` with an `owner` and `risk_if_wrong`; or a `question` addressed to the right person |
| skipped | keep the `question` open |

Record after each card in one `ba_record` batch. New people mentioned → `stakeholder`.
Expand the register in every interview: who else coordinates, uses, is affected, could block?

## Stopping

Stop when every topic of the map has content or an explicit "out of scope / open question
with an owner", and no critical conflict is unresolved — say **"NO MATERIAL GAPS"** and
summarise. If the user wants to stop earlier, stop and move gaps to open questions. Then save
`ba_document_save` kind `interview_notes` (participants, key facts with IDs, conflicts,
assumptions, open questions).

Interview protocol ideas from ba-toolkit (MIT) and rjmurillo/ai-agents requirements-interview (MIT); see NOTICE.md.
