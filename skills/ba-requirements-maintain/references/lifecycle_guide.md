> BA One Pass note: adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0. Tool names refer to BA One Pass native tools (see the ba-core skill). Field names in tables describe what to capture; store them in the `attrs` of the matching register item or in the stage document.

# Reference: Requirements Life Cycle and Attributes (BABOK 5.2)

## Status life cycle — full model

```
         ┌─────────────────────────────────────────┐
         │                                         │
  [draft] → [confirmed] → [approved] → [implemented] → [retired]
         ↑        ↓              ↓
     [on_hold]  [superseded]  [deprecated]
```

| Status | Meaning | Who changes it | Trigger |
|--------|-------|-----------|---------|
| `draft` | Requirement captured, not yet reviewed | BA | After 4.2 |
| `confirmed` | BA has reviewed internally, ready for sign-off | BA | After 4.3 |
| `approved` | Formally signed off by stakeholders | BA + stakeholder | After 5.5 |
| `implemented` | Implemented in the solution | BA/Dev | After component delivery |
| `on_hold` | Frozen — awaiting a decision or resources | BA | Team decision |
| `deprecated` | Outdated, but preserved in history | BA | After a CR or review |
| `superseded` | Replaced by another requirement (specify which) | BA | During restructuring |
| `retired` | Project closed, requirement archived | BA | Initiative closure |

**Important:** status can move backward. `approved → on_hold` when a budget freeze hits is normal.

---

## Requirement attributes — full set

### Required (all presets)

| Attribute | Type | Description |
|---------|-----|----------|
| `id` | string | Unique identifier: BR-001, FR-007, NFR-003 |
| `type` | enum | business / stakeholder / solution / transition |
| `title` | string | Short name |
| `status` | enum | see life cycle above |
| `version` | string | 1.0, 1.1, 2.0 — major.minor |
| `source` | string | Reference to the 4.3 artifact or the source stakeholder |

### Extended (Standard and Full)

| Attribute | Type | Description |
|---------|-----|----------|
| `priority` | enum | High / Medium / Low — updated in 5.3 |
| `owner` | string | Who is responsible for keeping this requirement current |
| `stability` | enum | Stable / Volatile / Unknown |
| `reuse_candidate` | bool | Candidate for reuse in other initiatives |
| `reuse_scope` | enum | initiative / program / division / enterprise |
| `complexity` | enum | Low / Medium / High |
| `last_reviewed` | date | Date of the last currency review |

---

## Versioning — rules

### When to change the version

| Change | Minor (1.0 → 1.1) | Major (1.0 → 2.0) |
|-----------|-------------------|-------------------|
| Wording clarification without a change in meaning | ✅ | — |
| Change to acceptance criteria | ✅ | — |
| Change in the meaning/substance of the requirement | — | ✅ |
| Merging two requirements into one | — | ✅ |
| Splitting a requirement into several | — | ✅ (+ new IDs) |
| Status change without a change in content | no version change | — |

### Version vs. status
Version reflects **content**. Status reflects **state in the process**.
Status `approved → on_hold` — the version does not change.
Rewording FR-007 — version 1.0 → 1.1, status may remain `confirmed`.

---

## Volatility — signals and thresholds

Volatility = number of versions over the requirement's lifetime.

| Version | Signal | BA action |
|--------|--------|-------------|
| 1.0 – 1.1 | Normal | — |
| 1.2 – 1.3 | Caution — requirement is unstable | Check the source of the instability |
| 1.4+ | 🔴 Alert — high volatility | Discuss with the owner; the problem may run deeper |

**Causes of high volatility:**
- The requirement was poorly elicited (go back to 4.2)
- The stakeholder hasn't settled on the need
- The business context is unstable (external changes)
- The requirement is too detailed — tied to a specific solution

---

## Reuse — criteria and levels

### Criteria for a good reuse candidate

✅ Worded without ties to a specific tool or department
✅ High level of abstraction (a business rule, not a screen form)
✅ Status `approved` or `implemented` — proven in practice
✅ Low volatility (version 1.0 – 1.1)
✅ Belongs to type `business` or `stakeholder` (not tied to a specific solution)

❌ Contains references to specific systems ("in SAP," "in module X")
❌ High volatility
❌ Status `deprecated` or `superseded`

### Levels of reuse

| Level | reuse_scope | Example |
|---------|-------------|--------|
| Within the initiative | `initiative` | FR reused in another component |
| Similar initiatives | `program` | Authorization requirement shared across several projects |
| Other departments | `division` | Calculation business rules shared across a department |
| Entire organization | `enterprise` | Corporate security standards |

---

## External stores

Export to external systems (Confluence, Notion, Jira) is done outside the session: the user exports the project from the BA One Pass panel. Do not try to sync from a skill.

## Integration with other BABOK tasks

| From | What is passed to 5.2 |
|--------|----------------------|
| 4.2 | Initial attributes: source, initial status=draft |
| 4.3 | status → confirmed, quality-checked |
| 5.1 | JSON repository — 5.2 works with the same file |
| 5.3 | priority is updated after prioritization |
| 5.4 | On a CR: status and version of affected requirements are updated |
| 5.5 | status → approved after formal sign-off |

| To | What 5.2 provides |
|------|--------------|
| 5.3 | Current attributes (stability, priority) for correct prioritization |
| 5.4 | Version history for assessing CR impact |
| 5.5 | Clean registry, free of orphans and deprecated items, for the approval package |
| 6.x | Reuse candidates for User Stories and Use Cases |
| Confluence | Maintained requirements via the export hook |
