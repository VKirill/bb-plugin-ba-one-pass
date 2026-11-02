// Stage catalog: which skills each stage session gets, what it reads and
// writes. The server uses it in bb.agents.configure; the app shows it.
import type { DocumentKind, ItemType, StageId } from "./model";

export interface StageDefinition {
  id: StageId;
  /** BABOK chapter(s) the stage follows, for display. */
  chapters: string;
  /** Skill frontmatter names (skills/<name>/SKILL.md). */
  skills: readonly string[];
  /** Register types the stage mainly produces. */
  produces: readonly ItemType[];
  /** Documents the stage is expected to produce. */
  documents: readonly DocumentKind[];
  /** Short English brief appended to the session instructions. */
  brief: string;
}

/** Always present in every BA session. */
export const CORE_SKILLS = ["ba-core"] as const;

/** Requirements life cycle (BABOK ch. 5) is available in every stage. */
export const LIFECYCLE_SKILLS = [
  "ba-traceability",
  "ba-requirements-maintain",
  "ba-prioritize",
  "ba-change-assess",
  "ba-approve",
] as const;

export const STAGES: Record<StageId, StageDefinition> = {
  plan: {
    id: "plan",
    chapters: "3",
    skills: ["ba-planning"],
    produces: ["stakeholder", "constraint", "assumption", "question", "decision"],
    documents: ["ba_plan"],
    brief:
      "Stage 0 — Frame and plan (BABOK ch. 3). Agree the business analysis approach, identify stakeholders and their engagement, governance (who approves what), information management and how BA performance is measured. Finish with the ba_plan document.",
  },
  elicit: {
    id: "elicit",
    chapters: "4",
    skills: [
      "ba-interview",
      "ba-elicitation-prep",
      "ba-elicitation-conduct",
      "ba-elicitation-confirm",
      "ba-communicate",
      "ba-collaborate",
    ],
    produces: ["source", "fact", "question", "assumption", "conflict", "stakeholder", "decision"],
    documents: ["elicitation_plan", "interview_notes", "meeting_notes", "confirmed_results", "comm_package"],
    brief:
      "Stage 1 — Elicitation and collaboration (BABOK ch. 4). Research available material first, then interview the user adaptively (ba_ask), process transcripts, record facts with sources, surface conflicts and assumptions immediately, confirm results.",
  },
  strategy: {
    id: "strategy",
    chapters: "6",
    skills: ["ba-current-state", "ba-future-state", "ba-risk-assessment", "ba-change-strategy"],
    produces: ["need", "state", "cause", "goal", "gap", "constraint", "risk", "decision"],
    documents: ["current_state", "future_state", "risk_assessment", "change_strategy"],
    brief:
      "Stage 2 — Strategy analysis (BABOK ch. 6). Describe the current state and root causes, define business needs, the future state with measurable goals, gaps, risks and the change strategy with solution scope.",
  },
  requirements: {
    id: "requirements",
    chapters: "7",
    skills: [
      "ba-requirements-spec",
      "ba-requirements-verify",
      "ba-requirements-validate",
      "ba-requirements-architecture",
      "ba-design-options",
      "ba-value-recommend",
    ],
    produces: ["requirement", "rule", "scenario", "criterion", "issue", "option", "term"],
    documents: [
      "requirements_spec",
      "verification_report",
      "validation_report",
      "architecture",
      "design_options",
      "recommendation",
      "brpv",
    ],
    brief:
      "Stage 3 — Requirements analysis and design definition (BABOK ch. 7). Specify requirements, rules, scenarios and acceptance criteria; verify quality (ba_check_quality), validate against goals, organise the requirements architecture, compare design options and recommend.",
  },
  lifecycle: {
    id: "lifecycle",
    chapters: "5",
    skills: [],
    produces: ["change", "decision"],
    documents: ["traceability", "prioritization", "change_decision", "approval_package", "baseline"],
    brief:
      "Requirements life cycle session (BABOK ch. 5): trace, maintain, prioritise, assess changes, approve and baseline requirements.",
  },
  "one-pass": {
    id: "one-pass",
    chapters: "3–7",
    skills: ["ba-one-pass", "ba-interview"],
    produces: ["stakeholder", "fact", "question", "assumption", "conflict", "goal", "requirement", "rule", "scenario", "criterion", "risk"],
    documents: ["brpv"],
    brief:
      "One Pass — run the whole business analysis of one feature or change in this session and finish with an agreed BRPV (Business Requirements & Product Vision) document.",
  },
};

/** Skills a session of the given stage gets. */
export function skillsForStage(stage: StageId): string[] {
  return [...new Set([...CORE_SKILLS, ...STAGES[stage].skills, ...LIFECYCLE_SKILLS])];
}

export const ALL_SKILLS: readonly string[] = [
  ...new Set([
    ...CORE_SKILLS,
    ...LIFECYCLE_SKILLS,
    ...Object.values(STAGES).flatMap((stage) => stage.skills),
  ]),
];
