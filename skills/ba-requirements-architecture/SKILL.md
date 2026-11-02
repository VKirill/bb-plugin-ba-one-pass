---
name: ba-requirements-architecture
description: >-
  BABOK 7.4 — Define requirements architecture: organise requirements into
  viewpoints (business processes, data, users and interaction, functionality,
  business rules, custom ones like security), record whose interests each
  requirement touches, find structural gaps and save the architecture
  document. Use after specification and validation. RU: архитектура
  требований, слои, представления, viewpoints, целостность требований.
---

# Define requirements architecture (BABOK 7.4)

"How do our requirements form a coherent picture?" A viewpoint is a stakeholder's
perspective; a view is the subset of requirements for it. Methodology:
`references/architecture_guide.md`.

## Default viewpoints by item

| Items | Viewpoint |
| --- | --- |
| scenarios with `format: process`, process models | Business processes |
| terms, data entities, ER models | Data and information |
| scenarios (user stories, use cases) | Users and interaction |
| requirements functional / nonfunctional | Functionality |
| rules | Business rules |
| goals | not a viewpoint (coverage axis) |

## Pipeline

1. **Analyse.** `ba_items` requirements, rules, scenarios, terms; group by viewpoint; build
   goals × viewpoints coverage; read the stakeholder register.
2. **Custom viewpoints** (optional; regulated projects: security, audit and compliance,
   migration): defined by explicit item IDs, not by type — only the analyst knows which
   requirements belong. Store the list in the item `attrs.layer` / `attrs.viewpoints`.
3. **Declare stakeholder interest**: whose interests each requirement touches. `ba_link`
   requirement `owned_by` stakeholder with `note: "interest: …"` — the note is printed in
   the architecture document. This differs from the requirement `owner` field (who answers
   for the wording) and from approval decisions (5.5); both also count as evidence of a
   tie, so do not re-enter them. Regulators and compliance officers rarely own or approve
   requirements — declare their interest explicitly. Changing an owner can leave the
   previous owner with no tie: check and declare if their interests are still touched.
4. **Gaps.**
   Level 1: stakeholder with no tie to any requirement (critical); tie only by a shared
   word (warning — a coincidence, not a fact); tie only to risks, goals or changes, or only
   to deprecated requirements (warning); goal with no viewpoint coverage (warning); empty
   viewpoint (info).
   Level 2 (`ba_trace` orphans and links): use case with no process (warning),
   non-functional requirement not linked to a functional one (warning), functional
   requirement with no scenario (info). Level 2 depends on how complete the links are —
   expect false positives if traceability is thin, and say so.
   Resolve critical gaps: declare known interests, create missing requirements (7.1) or add
   links (5.1).
5. **Save**: `ba_document_save` kind `architecture` with a version, viewpoint tables
   (deprecated items tagged), interests with notes, gaps recomputed at save time.
   Hand it to communication (4.4) and design options (7.5).

Adaptive projects: repeat at the end of each iteration; declarations merge safely.

Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0.
