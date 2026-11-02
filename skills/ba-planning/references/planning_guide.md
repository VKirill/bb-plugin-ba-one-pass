> BA One Pass note: adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0. Tool names refer to BA One Pass native tools (see the ba-core skill).

# Planning guide (BABOK ch. 3)

## Stakeholder register growth

```
Sponsor → names managers → who name experts →
experts name adjacent departments → and so on
```

After each elicitation session update the register (`ba_record` type stakeholder).

## Communication schedule by quadrant

| Quadrant | Frequency | Typical triggers |
| :--- | :--- | :--- |
| High influence / High interest | After every significant step | Any decision, requirements change, risks |
| High influence / Low interest | At milestones or on request | Only critical decisions and blockers |
| Low influence / High interest | After elicitation sessions they took part in | Follow-up after interviews, status updates |
| Low influence / Low interest | Rarely, as needed | Only if directly affected |

The schedule lives in the stakeholder's `attrs.frequency` and `attrs.trigger`; the
communication skill (4.4) uses it to see who has not been contacted and whose trigger fired.

## Power/interest matrix

| Influence ↑ / Interest → | Low | High |
| :--- | :--- | :--- |
| **High** | Keep satisfied — inform about milestones | Manage closely — involve in every decision |
| **Low** | Monitor — general distribution | Keep informed — demos, status updates |

## Governance default by criticality

| Criticality | Change control | Approval |
| :--- | :--- | :--- |
| High | Formal CR → change board | Sponsor + product owner |
| Medium | Product owner via backlog | Product owner + lead BA |
| Low | Logged in the tracker, verbal | Lead BA |

## Who reads the plan

| Decision | Read by |
| --- | --- |
| Decision makers | Approval (5.5) prints them; approval and change assessment (5.4) cross-check who actually decided |
| Escalation path | Change decision record (5.4) |
| Response deadline | Approval package (5.5) |
| Prioritisation technique, participants, criteria | Prioritisation (5.3) cross-checks the session |
| Criticality | Seeds the traceability level when none is stated |
| Detail per audience | Communication package (4.4) |
| Reuse scope, attributes | Requirements maintenance (5.2) |

Every one is a cross-check or a default, never an override: the user is told about the
difference and decides.

## Traceability levels

| Level | Meaning |
| :--- | :--- |
| High | Business objectives → requirements → test cases → code |
| Medium | Requirements linked to tracker tickets |
| Low | Basic requirement numbering |

## Warning signs for 3.5

- Requirements change even during development
- Developers complain about unclear or contradictory requirements
- No single place for requirements
- Onboarding a new BA takes more than a month
- No requirements quality metrics
