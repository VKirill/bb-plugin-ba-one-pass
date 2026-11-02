---
name: ba-value-recommend
description: >-
  BABOK 7.6 — Analyse potential value and recommend a solution: assess benefits,
  costs and risks of each design option, score value, and write the
  recommendation for the sponsor (recommend an option, two in parallel,
  re-analyse, or no action) with measurable success metrics. Use after design
  options. RU: ROI вариантов, ценность, рекомендация спонсору, какой вариант
  выбрать, стоит ли делать.
---

# Analyse potential value and recommend (BABOK 7.6)

Value = benefits − costs − risks. The final task of chapter 7: a recommendation for the
sponsor and the baseline for solution evaluation. Guide:
`references/value_assessment_guide.md`.

Inputs: options and allocation (7.5), goals and future state (6.2/7.3), qualitative value
from 6.2 (start from it, do not start from scratch), risks (6.3, `ba_items` type risk;
if none, take risks from the user), the architecture (7.4).

## Outcomes

| Type | When |
| --- | --- |
| Recommend an option | One option is clearly better |
| Recommend in parallel | Two options implemented in parallel |
| Re-analyse | No option fits — new analysis needed |
| No action | Benefits < costs + risks: the change is not justified |

## Pipeline

1. **Assess each option**: `ba_record` the option with `attrs.value: {benefits: [{type,
   magnitude, confidence}], costs: [...], risks: [R ids], alignment}`; link `mitigates` /
   `impacts` to risks.
2. **Compare**: `ba_calc` method `compare_options` (parameters: tool schema and `ba-core` skill `references/calc.md`) with value criteria
   (benefits, alignment, cost, risk penalty) — ranking and winner.
3. **Readiness check** (optional, informational): every option assessed, comparison done,
   critical gaps accounted for.
4. **Recommendation**: `ba_document_save` kind `recommendation` — type, the recommended
   option (not needed for re-analyse or no action), rationale with numbers, measurable
   success metrics (required when recommending an option: "NPS > 8", not "improve NPS"),
   risks and conditions. Mark the option `recommended` only after the user agrees.

Next: approval (5.5) of the requirements for v1; the BRPV document summarises the whole
path if the user needs one.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
