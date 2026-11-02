# BRPV quality checklist

Go through it before showing the document. `ba_check_quality` and `ba_trace` (coverage)
do the automatic part; check the rest yourself. Fix what you can; move the rest to open
questions. In the report to the user list only the failed items.

## Each requirement (ISO/IEC/IEEE 29148, 5.2.5)

- [ ] **Necessary** — linked to a goal `G-n`; without it the goal is not reached.
- [ ] **Unambiguous** — one reading; no "fast", "convenient", "etc.", "if necessary", "if
      possible", "and/or" (RU: «быстро», «удобно», «и т. д.», «при необходимости», «по
      возможности», «и/или»).
- [ ] **Singular** — one idea; no "and" between two different actions.
- [ ] **Complete** — understandable without verbal explanation: who, what, under which condition.
- [ ] **Feasible** — no known prohibition (law, platform, budget).
- [ ] **Verifiable** — at least one `AC-n` that gives a yes/no answer.
- [ ] **Implementation-free** — does not dictate technology, screen or API unless that is a constraint `CN-n`.
- [ ] **Sourced** — says where it came from (interview, document, code).

## The set of requirements (29148, 5.2.6)

- [ ] **Complete** — every goal has requirements; every Must requirement has a scenario and an AC.
- [ ] **Consistent** — requirements and rules do not contradict; all `CON-n` closed.
- [ ] **Feasible as a set** — the Must scope fits the time and budget constraints.
- [ ] **Comprehensible** — every special term is in the glossary.
- [ ] **Able to be validated** — the one-screen summary can be agreed without reading everything.

## The document

- [ ] All mandatory template sections are filled or explicitly marked "out of scope / Q-n".
- [ ] Goals are measurable (metric, current and target value, or a question about them).
- [ ] Scope has at least one "not included" item.
- [ ] Scenarios include exceptions, not only the main path.
- [ ] Every assumption `ASM-n` has an owner and a risk.
- [ ] The traceability matrix has no empty cells for Must.
- [ ] No secrets, passwords, tokens or personal data of real customers.
- [ ] The "Handoff" section is filled.

## Signs of shallow analysis

- Not a single conflict or assumption found — you probably did not look.
- Everything is Must — priorities were not set.
- Requirements retell the interface ("button", "field", "page") — that is already design.
- Metrics without numbers or deadlines.
