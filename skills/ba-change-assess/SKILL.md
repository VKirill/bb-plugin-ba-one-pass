---
name: ba-change-assess
description: >-
  BABOK 5.4 — Assess requirements changes: register a change request, analyse
  its impact through the traceability graph, score it on benefit, cost,
  impact, schedule and urgency, record the authorised decision and update
  affected requirements. Use when someone asks to change scope or a
  requirement. RU: пришёл CR, запрос на изменение, оцени изменение, влияние.
---

# Assess requirements changes (BABOK 5.4)

The change gatekeeper. Every change request (CR) goes through four steps:
open → impact → score → decision. You recommend; the authorised stakeholder decides.
Details: `references/cr_assessment_guide.md`.

Inputs: the graph (5.1), stability (version history, 5.2), priorities (5.3), governance —
who may decide and the escalation path (`ba_context` include `plan`), the decision log.

## 1. Open

Type (new requirement / change / removal / architectural), requester, reason,
affected areas, formality (predictive and close to release → high; adaptive at the start
of an iteration → standard; regulatory → always high, urgency critical).
`ba_record` type `change`, `attrs: {requester, reason, urgency, change_type,
formality, related: [CR ids]}`. Related CRs are assessed together.

## 2. Impact

`ba_trace` mode `impact` from each target requirement. Read the result by relation:
`depends_on` (may lose meaning), `verifies` (criteria to rewrite), `satisfies` (options
or components to rework), `derives_from` (children inherit the change). Link the CR
`impacts` each directly changed item (`ba_link`). Check: affected requirements without a
business parent; volatile requirements (double uncertainty — recommend stabilising
first). If the scope is unexpectedly large, tell the requester before scoring — many CRs
are withdrawn here.

## 3. Score

`ba_calc` method `change_score` (parameters: tool schema and `ba-core` skill `references/calc.md`): technical axes from the
impact, business axes from the user — benefit (high/medium/low), cost (low/medium/high,
including opportunity cost), urgency (critical/high/normal). Result: a score and a
preliminary verdict (approve / modify / defer / reject). You may adjust it with an
explicit reason. Also check conflicts with Must/Won't priorities. Record the result in
the CR `attrs.score`, status `assessed`.

## 4. Decision

Get the decision from the authorised person (governance; if someone else decided, flag
the mismatch — never block or rewrite the name). Rationale is mandatory.
- `ba_record` the CR: status `approved` / `rejected` (deferred → keep `assessed` with
  `attrs.decision: "deferred"`), and a `decision` item linked `impacts` to the CR.
- Approved: mark affected requirements `attrs.under_change: "<CR id>"`, update their
  content (ba-requirements-maintain) within one iteration, then re-prioritise if
  Must/Won't are affected.
- `ba_document_save` kind `change_decision`: CR, impact, score, decision, rationale,
  who decided; share it (ba-communicate).
Rejected and deferred CRs stay in the register — they are the audit trail.

5.4 does not change requirement content itself, re-prioritise (5.3) or approve (5.5).

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
