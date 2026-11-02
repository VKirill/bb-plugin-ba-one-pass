# NOTICE

BA One Pass — Copyright (c) 2026 Kirill Vechkasov. Licensed under the GNU Affero General
Public License v3.0 (see `LICENSE`).

## Derived from AIналитик (ainalyst)

This plugin is a derivative work of **AIналитик** by Anatoly Chaussky —
https://github.com/chaussky/ainalyst — Copyright (c) 2026 Anatoly Chaussky, licensed under
AGPL-3.0 (commit `b43506b`, 2026-08-31; branches `main` and `ru`). Adapted parts:

- the text of the 21 BABOK task skills (`skills/ba-*`, except `ba-core`, `ba-interview`
  and `ba-one-pass`) and their `references/` guides, rewritten for BA One Pass native
  tools instead of the original MCP servers;
- the methodology map: stages, tasks, cross-chapter inputs and outputs, the
  "warn, don't block" rule;
- the deterministic calculators (prioritisation aggregation, risk matrix, change request
  scoring, option comparison, gap analysis) and the vague-word lists (English and Russian)
  used by the quality check, ported to TypeScript.

Changes: skills shortened and restructured, Claude-Code-specific mechanics (phases, MCP
configuration, hooks, file storage) removed, data moved to the plugin database, register
types and statuses unified. AIналитик is also offered under a commercial licence by its
author; that licence does not cover this plugin.

## Ideas from MIT-licensed projects

- Interview protocol — one topic per question, options with a single recommendation,
  "don't know" as a valid answer: **ba-toolkit** by Takhir Kudusov,
  https://github.com/TakhirKudusov/ba-toolkit (MIT).
- Scoring requirements 0–3 against ISO/IEC/IEEE 29148 characteristics: **hve-core**
  requirements-author by Microsoft, https://github.com/microsoft/hve-core (MIT; skill text
  CC-BY-4.0 — no text copied).
- Answer statuses (confirmed / overridden / deferred / out of scope) and the
  "no material gaps" stop criterion: **requirements-interview** in
  https://github.com/rjmurillo/ai-agents (MIT).

## Trademarks

BABOK® is a registered trademark of the International Institute of Business Analysis
(IIBA). This plugin is not affiliated with or endorsed by IIBA. It follows the structure of
BABOK v3 and does not reproduce the guide's text.
