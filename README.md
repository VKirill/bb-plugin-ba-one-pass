# BA One Pass — business analyst chat for BB

A [BB](https://getbb.app) plugin that turns an agent into a business analyst working by
stages, the way BABOK® v3 describes the work. It keeps BA **projects**, runs **sessions**
(BB threads with the skills and tools of one stage) and collects the **documentation**:
registers, traceability and versioned documents, all readable in the plugin's own panel.

The analyst is a methodologist, secretary and controller. People decide: every fact keeps
its source, every document has a status (draft → review → approved), and the stage gates
warn without blocking.

## What you get

- **Projects.** A BA project is bound to a BB project, so its sessions can read the
  product's code and docs. Two modes: the full path by stages, or **One Pass**, which runs
  the whole analysis of one feature in one session and ends with a BRPV (Business
  Requirements & Product Vision) document.
- **Stage sessions.** Each session is a BB thread. `bb.agents.configure` gives it only the
  skills, tools and instructions of its stage, so the model keeps a small context. Changing
  stage needs no restart: the next session starts with the new set.

  | Stage | BABOK | Skills |
  | --- | --- | --- |
  | Frame & plan | ch. 3 | ba-planning |
  | Elicitation | ch. 4 | ba-interview, ba-elicitation-prep/conduct/confirm, ba-communicate, ba-collaborate |
  | Strategy analysis | ch. 6 | ba-current-state, ba-future-state, ba-risk-assessment, ba-change-strategy |
  | Requirements & design | ch. 7 | ba-requirements-spec/verify/validate/architecture, ba-design-options, ba-value-recommend |
  | Life cycle (every stage) | ch. 5 | ba-traceability, ba-requirements-maintain, ba-prioritize, ba-change-assess, ba-approve |
  | One Pass | 3–7 | ba-one-pass, ba-interview |

- **Registers** with typed IDs: stakeholders `ST`, sources `SRC`, facts `F`, questions `Q`,
  assumptions `ASM`, conflicts `CON`, decisions `D` (append-only), needs `BN`, goals `G`,
  requirements `BR/SR/FR/NFR/TR`, rules `RULE`, scenarios `SC`, acceptance criteria `AC`,
  risks `R`, options `OPT`, change requests `CR` and more. Every change keeps a version.
- **Traceability graph** with impact analysis, coverage gaps and a matrix.
- **Checks in code, not prompts**: ISO/IEC/IEEE 29148 quality scoring (0–3 per
  characteristic, vague words in English and Russian), stage gates, prioritisation
  (MoSCoW, WSJF, impact/effort, time boxing), risk matrix, option comparison and change
  request scoring.
- **Question cards.** `ba_ask` shows 1–3 questions in the composer with a recommended
  answer and an "I don't know" choice; answers come back as confirmed, overridden,
  unknown or skipped.
- **Panel UI** in English and Russian: project cards, a stage stepper with the gate
  checklist, sessions with the embedded BB chat, a document reader with versions and
  approval, register tables, the traceability matrix and Markdown export.

## Agent tools

`ba_context`, `ba_items`, `ba_record`, `ba_link`, `ba_trace`, `ba_documents`,
`ba_document_save`, `ba_check_quality`, `ba_calc`, `ba_gate`, `ba_ask`, `ba_stage_set`,
`ba_session_close`. They exist only in BA sessions; other threads see nothing from this
plugin. Details: [docs/agent-tools.md](docs/agent-tools.md), calculations:
[docs/calc.md](docs/calc.md).

## Install

```sh
bb plugin install git:https://github.com/VKirill/bb-plugin-ba-one-pass.git
```

Open **BA One Pass** in the BB sidebar, create a project and start a session.

## Develop

```sh
npm install
npm run typecheck
npm test
bb plugin build .
```

Data lives in the plugin's SQLite database (`<dataDir>/plugins/ba-one-pass/data.db`).

## License and credits

AGPL-3.0, see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). The methodology, skills,
references and calculators are adapted from
[AIналитик](https://github.com/chaussky/ainalyst) by Anatoly Chaussky (AGPL-3.0).
Interview and quality ideas also come from ba-toolkit, hve-core and requirements-interview
(MIT).

BABOK® is a registered trademark of the International Institute of Business Analysis
(IIBA). This plugin is not affiliated with or endorsed by IIBA.
