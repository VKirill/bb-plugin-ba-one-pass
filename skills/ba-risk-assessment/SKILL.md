---
name: ba-risk-assessment
description: >-
  BABOK 6.3 — Assess risks: collect risks from elicitation, current and future
  state, word them "If X, then Y", score likelihood × impact, set the risk
  tolerance, build the risk matrix and give the sponsor a recommendation
  (proceed, proceed with mitigation, seek higher value, do not proceed). Use for
  risk analysis of an initiative. RU: риски, оценка рисков, матрица рисков,
  риск-реестр, толерантность к риску.
---

# Assess risks (BABOK 6.3)

Risks are uncertainty that threatens business goals. Identify, score
(likelihood × impact), plan responses and recommend: proceed / proceed with
mitigation / seek higher value / do not proceed.

Inputs (all optional): causes and needs (6.1), constraints and gaps (6.2), risks
stakeholders mentioned (4.2 facts), stakeholders for owners. 6.3 also works alone.

## 1. Scope

Initiative type, depth (quick ≈ an hour, 3–5 risks; standard 7–15; comprehensive 15–30),
which earlier analysis exists. Record `decision {topic: "risk_assessment_scope", ...}`.

## 2. Draft from context (recommended)

`ba_items` types risk, constraint, gap, cause, assumption, conflict, and facts mentioning
risks. Propose drafts; the user confirms which to keep. If the sponsor says "we have no
risks", show these drafts — constraints and gaps almost always hide some.

## 3. Add risks

`ba_record` type `risk`: title in the form "If [trigger], then [consequence]" ("Integration
risk" is bad; "If the legacy API lacks the needed methods, integration takes 6 weeks
longer" is good). `attrs: {category: strategic|operational|financial|technical|regulatory|people|external,
probability: 1-5, impact: 1-5, probability_rationale, impact_rationale,
response: accept|mitigate|transfer|avoid, mitigation_plan (required for mitigate)}`,
`owner` from the stakeholder register, links `impacts` → threatened goals/needs.
Scales: `references/risk_assessment_guide.md` §2–3. Seven precise risks beat 25 vague ones.
Avoid only when impact is critical and mitigation is impossible or costs more than the
benefit; otherwise mitigate with a concrete plan.

## 4. Tolerance

Risk-averse (bank, public sector, pharma; threshold 10–12), neutral (threshold 15),
risk-seeking (startup; 18–20). If the sponsor did not state it, use the questions in
`references/risk_tolerance_guide.md` §5. Record `decision {topic: "risk_tolerance",
level, threshold, sponsor_position}`.

## 5. Matrix

`ba_calc` method `risk_matrix` (parameters: tool schema and `ba-core` skill `references/calc.md`) with the threshold: zones
low/medium/high, cumulative profile. Discuss the top 3 high risks with the user before
recommending.

## 6. Recommendation

Rules: critical risks with no possible mitigation → do not proceed (outranks all); value
does not justify manageable risks (the user's judgement — there is no honest arithmetic
here) → seek higher value; nothing above the threshold → proceed; high risks that can be
mitigated → proceed with mitigation. Write 2–4 sentences with concrete numbers (how many
risks, which are high, top risk with score, how mitigation changes the profile).

## 7. Save

`ba_document_save` kind `risk_assessment`: scope, tolerance, register table, matrix,
top risks, recommendation. Tell the user the top 3 risks for immediate action.
Next: the change strategy (6.4) uses the register; value assessment (7.6) uses the profile.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
