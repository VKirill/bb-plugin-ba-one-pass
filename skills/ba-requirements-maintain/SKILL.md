---
name: ba-requirements-maintain
description: >-
  BABOK 5.2 — Maintain requirements: keep content, statuses, versions and
  attributes current, deprecate or replace outdated requirements, audit register
  health, find requirements to reuse. Use when a requirement changes status,
  becomes obsolete, or before prioritisation and approval. RU: обнови
  требование, устарело, заменить, здоровье реестра, повторное использование.
---

# Maintain requirements (BABOK 5.2)

5.1 builds the graph; 5.2 keeps the graph and the requirements from going stale — and
regularly, not only when a change request comes in. Three elements: content stays
correct, attributes stay current, requirements stay reusable.

## Mode A — Update a requirement or its attributes

1. Content or only an attribute?
2. `ba_record` with the id. Every update keeps the previous version in history; put the
   reason in `note`. Substantial content changes (merge, split, change of meaning) → also
   record a `decision`.
3. If the change came from a change request → run `ba_trace` impact first (5.1).
4. Do not set `approved` here: only the approval skill (5.5) records approval after the
   user's explicit sign-off.

## Mode B — Deprecate or replace

1. Reason: outdated, replaced, removed by a change request, project closed?
2. `ba_record` status `deprecated` with the reason in `note`; if replaced, link the new
   requirement `replaces` the old one.
3. Check active links to it (`ba_trace` impact) and fix them.
Never delete — history is kept for audit and traceability.

## Mode C — Register health

Before 5.3 and 5.5, and once per stage: `ba_trace` mode `orphans` and
`ba_check_quality` on requirements; `ba_items` to see items stuck in `draft`, changed
many times (high version = volatile), or without `owner`.
- Volatile → find the root cause with the stakeholder.
- Long in draft → confirm or freeze.
- Missing attributes → fill in per the attribute set from the BA plan (3.4); without a
  plan check `owner` only.
Decide for each: update, freeze or deprecate.

## Mode D — Reuse

`ba_items` with `query` / `types`. A good candidate: worded without ties to one system or
department, status approved, low volatility. Stakeholders review before reuse; a reused
requirement is a new record with `sources: [{kind: "item", ref: "<original id>"}]`.
The higher the abstraction, the better for reuse.

## Attributes

| Attribute | Where | Preset |
|---|---|---|
| status, version, sources | fields | always |
| priority, owner | fields | standard+ |
| stability, reuse_candidate | `attrs` | standard+ |
| reuse_scope, complexity | `attrs` | full |

Details: `references/lifecycle_guide.md`.

5.2 does not prioritise (5.3), assess changes (5.4), approve (5.5) or build links (5.1).

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
