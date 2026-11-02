---
name: ba-design-options
description: >-
  BABOK 7.5 — Define design options: build, buy, configure or hybrid options
  with components, improvement opportunities and effectiveness measures,
  allocate requirements to releases (v1, v2, out of scope) respecting
  dependencies, compare options on criteria and save the design options
  report. Use after requirements are validated. RU: варианты реализации, build
  vs buy, купить или разработать, релизы, MVP, распределение требований.
---

# Define design options (BABOK 7.5)

The analyst turns requirements into concrete solution options. Merges three BABOK v2
tasks: solution approach, assessment of options, requirement allocation. Output → 7.6.
Guide: `references/design_options_guide.md`.

Inputs (all optional, degrade gracefully): change strategy (6.4 document and the
`solution_scope` decision — read it, do not re-enter; if chapter 6 was skipped, agree a
short strategy with the user and record `decision {topic: "change_strategy", change_type,
scope, constraints, timeline}`), priorities (5.3), goals and future state (6.2/7.3), the
architecture (7.4), `depends_on` links (5.1).

## Pipeline

1. **Options** (usually 2–3): `ba_record` type `option`, `attrs: {approach:
   build|buy|configure|outsource|hybrid, components: [...], improvement_opportunities:
   [{type: efficiency|information_access|new_capability, description}],
   effectiveness_measures: [...], vendor_notes (buy/hybrid), cost, effort}`. Updating
   the same option keeps history.
2. **Allocate requirements** per option to v1 / v2 / out of scope. Suggest from priority:
   Must → v1, Should → v1 or v2, Could → v2, Won't → out of scope; the user confirms or
   overrides with a rationale. Record: `ba_link` option `satisfies` requirement with
   `note: "v1"` (or v2), and the out-of-scope list in the option `attrs.out_of_scope`.
   Check dependencies: if A (v1) `depends_on` B (v2), warn and suggest a fix.
3. **Compare** with `ba_calc` method `compare_options` (parameters: tool schema and `ba-core` skill `references/calc.md`). Default criteria:
   cost, speed, risk, requirements coverage, flexibility; custom criteria allowed.
4. **Report**: `ba_document_save` kind `design_options` — options, allocation map,
   improvement opportunities, comparison, an optional preliminary view. The final
   recommendation belongs to 7.6.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
