# `ba_calc` — deterministic calculations

`ba_calc` takes one object with a `method` field. It reads the project register, returns a
Markdown result for you to show or quote, and writes the computed fields back to the items
it scored (listed under "Writes back"). It never changes statuses: decide those yourself
with `ba_record` after the user agrees.

Formulas are adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.

## `prioritize`

Aggregates stakeholder scores into priorities, weighted by stakeholder influence
(`attrs.influence` of the `ST-n` item: high = 3, medium = 2, low = 1; a name that is not an
`ST` id counts as medium).

| Field | Type | Notes |
| --- | --- | --- |
| `technique` | `moscow` \| `wsjf` \| `impact_effort` \| `time_boxing` | |
| `scores` | `[{ stakeholder, item, value?, bv?, tc?, rr?, js?, impact?, effort?, cost? }]` | One row per stakeholder × requirement |
| `capacity` | number | `time_boxing` only: box size in the unit of `cost` |
| `quadrant_mapping` | `{ quick_wins?, big_bets?, fill_ins?, thankless_tasks? }` | `impact_effort`; default must / should / could / wont |
| `conflict_threshold` | 1 \| 2 \| 3 | MoSCoW category spread that counts as a conflict; default 2 |

- **moscow** — `value`: must/should/could/wont (4/3/2/1). Weighted average ≥ 3.5 must, ≥ 2.5 should, ≥ 1.5 could, else wont.
- **wsjf** — `bv` business value, `tc` time criticality, `rr` risk reduction / opportunity, `js` job size. CoD = influence-weighted (bv+tc+rr); WSJF = CoD / mean js (job size is not weighted). Labels by ratio to the best: ≥ 0.7 must, ≥ 0.4 should, ≥ 0.2 could.
- **impact_effort** — `impact`, `effort`: high/medium/low. Average ≥ 2.5 = high. Quick wins (high impact, low effort), big bets, fill-ins, thankless tasks.
- **time_boxing** — `value` (MoSCoW) and `cost`. Every active requirement is in the backlog; the box is filled by value, then cheapest, then id. Items that do not fit become wont; items nobody costed get no priority and are listed. A `wont` vote in this session excludes the item.

Also reports stakeholder conflicts (moscow / time_boxing), dependency violations (a higher
priority item `depends_on` a lower one) and Must inflation (> 60 % Must).

Writes back: `priority`; `attrs.priority_method`, `attrs.priority_score` and method details
(`wsjf`, `cost_of_delay`, `job_size`, `quadrant`, `in_box`, `cost`, `cumulative`).

```json
{ "method": "prioritize", "technique": "moscow", "scores": [
  { "stakeholder": "ST-1", "item": "FR-1", "value": "must" },
  { "stakeholder": "ST-2", "item": "FR-1", "value": "could" }
] }
```

## `risk_matrix`

Classifies risks by score = probability × impact (each 1–5 in `attrs`).

| Field | Type | Notes |
| --- | --- | --- |
| `ids` | string[] | Default: all `open` and `accepted` risks |
| `max_acceptable_score` | 1–25 | Score ≥ this is High; default 15 (risk-averse 10–12, neutral 14–16, risk-seeking 18–20) |
| `tolerance` | `risk_averse` \| `neutral` \| `risk_seeking` | Shown in the report |
| `mandatory_avoid_categories` | string[] | A risk of this `attrs.category` is High unless `attrs.response` is avoid |
| `value_vs_risk` | `value_exceeds_risk` \| `comparable` \| `risk_exceeds_value` | Your judgement after 6.2 |

Zones: High ≥ threshold, Medium ≥ 6, Low below. Recommendation:
`do_not_proceed` (a High risk with impact 5, response accept and no `attrs.mitigation`) →
`seek_higher_value` (you judged risk_exceeds_value) → `proceed_despite_risk` (no High) →
`proceed_with_mitigation`.

Writes back: `attrs.score`, `attrs.zone`.

```json
{ "method": "risk_matrix", "max_acceptable_score": 12, "mandatory_avoid_categories": ["regulatory"] }
```

## `compare_options`

Ranks design options (`OPT-n`).

| Field | Type | Notes |
| --- | --- | --- |
| `ids` | string[] | Default: all active options |
| `criteria` | `[{ id, label?, weight: number \| high \| medium \| low }]` | Scores come from each option's `attrs.scores[id]`, scale 1–5 |
| `parallel_margin` | 0–1 | Top two closer than this share → `recommend_parallel`; default 0.1 |
| `min_score` | number | Best below it → `recommend_reanalyze`; default 3 (criteria) or 2 (value) |

Without `criteria` the value formula is used:
`Benefits×2.0 + Alignment×1.5 − Cost×1.5 − Risk×1.0`, where
benefits = mean of magnitude (low 1, medium 2, high 3) × confidence (low 0.5, medium 1, high 1.5)
over `attrs.benefits`; cost = mean magnitude of `attrs.cost_items` or `attrs.cost`;
alignment = `attrs.alignment` (0–1) or the share of active goals the option `satisfies`/`addresses`;
risk = the highest level among `attrs.risk_level` and linked risks (low 0, medium 1, high 2, critical 3).

Recommendations: `recommend_option`, `recommend_parallel`, `recommend_reanalyze`, `no_action`.

Writes back: `attrs.score`, `attrs.rank`, `attrs.recommended`.

```json
{ "method": "compare_options", "criteria": [
  { "id": "cost", "label": "Total cost", "weight": "high" },
  { "id": "fit", "label": "Fit to requirements", "weight": 2 }
] }
```

## `change_score`

Scores a change request (`CR-n`).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | The CR |
| `benefit` | high \| medium \| low | |
| `cost` | high \| medium \| low | Including opportunity cost |
| `urgency` | critical \| high \| normal | Default normal |
| `phase` | development \| pre_release \| post_release | Default development |
| `targets` | string[] | What the CR changes; default its outgoing `impacts` links |
| `regulatory` | boolean | Or `attrs.regulatory` on the CR; a regulatory CR is never rejected (defer instead) |

Impact (auto): targets plus everything that depends on them (3 hops) — ≥ 8 high, ≥ 3 medium, else low.
Schedule risk (auto): high before/after release or ≥ 8 items, medium ≥ 3, else low.
Score = Benefit×2 + Urgency×1.5 + Impact×1 − Cost×1.5 − ScheduleRisk×1 (each 1–3).
Verdict: ≥ 8 approve, ≥ 4 modify, ≥ 1 defer, else reject. Checks: targets with no trace to a
business requirement, goal or need; targets with Won't priority.

Writes back: `attrs.assessment` on the CR (score, verdict, axes, targets, affected). Set the
CR status to `assessed` with `ba_record` yourself.

```json
{ "method": "change_score", "id": "CR-1", "benefit": "high", "cost": "medium", "urgency": "high" }
```

## `gap_summary`

No parameters. Current vs future state elements (`SE-n` with `attrs.side` and
`attrs.category`), gaps and what addresses them, needs not addressed by any requirement or
option, goals without KPI or target. Writes nothing.

```json
{ "method": "gap_summary" }
```
