---
name: ba-elicitation-prep
description: >-
  BABOK 4.1 — Prepare for elicitation: objectives, participants, technique
  (interview, survey, workshop, document analysis, observation, prototyping),
  questions or agenda; saves an elicitation_plan document. Use before an
  interview, workshop or survey. RU: подготовка к интервью, список вопросов,
  воркшоп, опрос, план выявления, с кем говорить.
---

# Prepare for elicitation (BABOK 4.1)

Help the analyst prepare one elicitation activity. One block at a time; move on only
after an answer. Start with `ba_context` (include `plan`, `stakeholders`): the BA plan
(3.1) and the stakeholder register (3.2) are inputs — reuse them, do not ask again.

## 1. Objectives

Why this elicitation? Phrase verifiable outcomes:

```
By the end of elicitation we must understand / confirm / obtain:
1. [specific outcome]
2. [specific outcome]
```

A good objective is checkable: after the session you either got it or not.

## 2. Participants

Who owns the process or problem, who uses the outcome, who can block or speed the
change, who has expertise? For each: role, influence, interest, what we want to learn.
New people → `ba_record` type `stakeholder`. Many people → group them and choose a
technique per group.

## 3. Technique

```
One stakeholder, need depth              → Interview
Many stakeholders, standard data         → Survey
Alignment across groups                  → Workshop
Ideas without constraints                → Brainstorming
Documents / legacy system exist          → Document analysis
Need to see the real as-is work          → Observation
Vague requirements, need visuals         → Prototyping
```

Details and question banks: `references/techniques.md`. If the BA plan recommends a
technique, cross-check and say plainly when the choice differs (or when the plan
recommends none — common on adaptive projects). Warn, don't block.

If the person to interview is the user of this chat, the interview can run right here
with the `ba-interview` skill.

## 4. Questions or agenda

Prepare them from the technique section of `references/techniques.md`: open questions
first, then specifics; expansion questions for the stakeholder register ("who else…").

## 5. Save the plan

`ba_document_save` kind `elicitation_plan` (project language):

```
## Elicitation plan
Project · Date
### Objectives
### Participants (table)
### Technique and why
### Questions / agenda
### Expected outcomes
### Planned period (from the BA plan, if any)
```

For a survey: draft the questions here; the user runs the survey in their own tool and
brings the answers back for `ba-elicitation-conduct`.

Next step: run the elicitation, then process the material with `ba-elicitation-conduct`.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
