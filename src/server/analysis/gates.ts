// Stage gates: deterministic readiness checks. Gates warn; they never block —
// moving on with a failing blocking check needs an explicit accepted risk.
// Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0
// — the check_*_completeness / check_*_readiness tools of chapters 3–7 and the
// "warn, don't block" contract of 7.2 → 7.3 → 5.5.
import type { GateCheck, GateStatus, Item, StageId } from "../../shared/model";
import { BLOCKING_CHARACTERISTICS, checkQuality } from "./quality";
import { attrNumber, attrString, hasDocument, isActive, type ProjectSnapshot } from "./snapshot";
import { criteriaOf, requirementsOf, traceCoverage } from "./trace";

const MAX_ITEMS = 20;

function check(id: string, passed: boolean, blocking: boolean, detail: string, items: string[] = []): GateCheck {
  return { id, label: `gate.${id}`, passed, blocking, detail, items: items.slice(0, MAX_ITEMS) };
}

function ofType(s: ProjectSnapshot, type: Item["type"]): Item[] {
  return s.items.filter((item) => item.type === type && isActive(item));
}

const SPONSOR_ROLE = /sponsor|approver|owner|decision|спонсор|утвержда|заказчик|владелец/iu;

function isSponsor(item: Item): boolean {
  const raci = attrString(item, "raci").toUpperCase();
  return SPONSOR_ROLE.test(attrString(item, "role")) || /(^|[^A-Z])A([^A-Z]|$)/u.test(raci);
}

function planChecks(s: ProjectSnapshot): GateCheck[] {
  const stakeholders = s.items.filter((item) => item.type === "stakeholder" && item.status === "active");
  return [
    check("plan.goal", s.project.goal.trim() !== "", true, "The project has a stated goal (project card)."),
    check(
      "plan.stakeholders",
      stakeholders.length >= 3,
      true,
      `At least 3 active stakeholders are identified (now ${stakeholders.length}).`,
    ),
    check(
      "plan.sponsor",
      stakeholders.some(isSponsor),
      true,
      "A sponsor / approver is named (stakeholder role sponsor/approver or RACI 'A').",
    ),
    check("plan.document", hasDocument(s, "ba_plan"), false, "The ba_plan document exists."),
  ];
}

function openConflicts(s: ProjectSnapshot): string[] {
  return s.items.filter((item) => item.type === "conflict" && item.status === "open").map((item) => item.id);
}

function elicitChecks(s: ProjectSnapshot): GateCheck[] {
  const facts = ofType(s, "fact");
  const sources = ofType(s, "source");
  const unsourced = facts.filter((fact) => fact.sources.length === 0).map((fact) => fact.id);
  const conflicts = openConflicts(s);
  const questions = s.items.filter((item) => item.type === "question" && item.status === "open").map((item) => item.id);
  return [
    check(
      "elicit.material",
      facts.length + sources.length > 0,
      true,
      `Elicited material exists (${sources.length} sources, ${facts.length} facts).`,
    ),
    check("elicit.sourced", unsourced.length === 0, true, "Every fact cites a source.", unsourced),
    check("elicit.conflicts", conflicts.length === 0, true, "No open conflicts remain unresolved.", conflicts),
    check("elicit.questions", questions.length === 0, false, `Open questions: ${questions.length}.`, questions),
    check(
      "elicit.document",
      hasDocument(s, "confirmed_results", "interview_notes"),
      false,
      "Interview notes or confirmed results are documented.",
    ),
  ];
}

function strategyChecks(s: ProjectSnapshot): GateCheck[] {
  const needs = ofType(s, "need");
  const goals = ofType(s, "goal");
  const goalsWithoutKpi = goals
    .filter((goal) => attrString(goal, "kpi") === "" || attrString(goal, "target") === "")
    .map((goal) => goal.id);
  const risks = ofType(s, "risk").filter((risk) => risk.status !== "closed");
  const unscored = risks
    .filter((risk) => attrNumber(risk, "probability") === null || attrNumber(risk, "impact") === null)
    .map((risk) => risk.id);
  return [
    check("strategy.needs", needs.length > 0, true, `At least one business need is defined (now ${needs.length}).`),
    check(
      "strategy.goals",
      goals.length > 0 && goalsWithoutKpi.length === 0,
      true,
      goals.length === 0 ? "No goals yet: define measurable goals." : "Every goal has a KPI and a target value.",
      goalsWithoutKpi,
    ),
    check("strategy.current", hasDocument(s, "current_state"), false, "The current_state document exists."),
    check("strategy.future", hasDocument(s, "future_state"), false, "The future_state document exists."),
    check("strategy.risks", unscored.length === 0, false, "Every open risk has probability and impact (1–5).", unscored),
  ];
}

function mustRequirements(s: ProjectSnapshot): Item[] {
  return requirementsOf(s).filter((req) => req.priority === "must");
}

function mustCriteriaCheck(s: ProjectSnapshot, id: string): GateCheck {
  const missing = mustRequirements(s)
    .filter((req) => criteriaOf(s, req.id).length === 0)
    .map((req) => req.id);
  return check(id, missing.length === 0, true, "Every Must requirement has at least one acceptance criterion (verifies link).", missing);
}

function mustQualityCheck(s: ProjectSnapshot, id: string): GateCheck {
  const must = mustRequirements(s).map((req) => req.id);
  const failing =
    must.length === 0
      ? []
      : checkQuality(s, { ids: must })
          .results.filter((result) => BLOCKING_CHARACTERISTICS.some((c) => result.scores[c] < 2))
          .map((result) => result.id);
  return check(
    id,
    failing.length === 0,
    true,
    `Must requirements score ≥ 2 on ${BLOCKING_CHARACTERISTICS.join(", ")} (ba_check_quality).`,
    failing,
  );
}

function requirementsChecks(s: ProjectSnapshot): GateCheck[] {
  const requirements = requirementsOf(s);
  const coverage = traceCoverage(s);
  const blockingIssues = s.items
    .filter((item) => item.type === "issue" && item.status === "open" && item.attrs.blocking === true)
    .map((item) => item.id);
  return [
    check("requirements.exist", requirements.length > 0, true, `Requirements are specified (now ${requirements.length}).`),
    mustCriteriaCheck(s, "requirements.criteria"),
    mustQualityCheck(s, "requirements.quality"),
    check(
      "requirements.coverage",
      coverage.uncovered.goals.length === 0,
      true,
      "Every goal is satisfied by at least one requirement.",
      coverage.uncovered.goals,
    ),
    check("requirements.issues", blockingIssues.length === 0, true, "No open blocking verification issues.", blockingIssues),
    check("requirements.document", hasDocument(s, "brpv", "requirements_spec"), false, "A BRPV or requirements_spec document exists."),
  ];
}

function lifecycleChecks(s: ProjectSnapshot): GateCheck[] {
  const unassessed = s.items
    .filter((item) => item.type === "change" && item.status === "open" && item.attrs.assessment === undefined)
    .map((item) => item.id);
  const approved = requirementsOf(s).filter((req) => req.status === "approved");
  return [
    check("lifecycle.changes", unassessed.length === 0, true, "Every open change request is assessed (ba_calc change_score).", unassessed),
    check(
      "lifecycle.baseline",
      approved.length === 0 || hasDocument(s, "baseline"),
      false,
      "Approved requirements are captured in a baseline document.",
      hasDocument(s, "baseline") ? [] : approved.map((req) => req.id),
    ),
  ];
}

function onePassChecks(s: ProjectSnapshot): GateCheck[] {
  const conflicts = openConflicts(s);
  return [
    check("onepass.document", hasDocument(s, "brpv"), true, "The BRPV document exists."),
    mustCriteriaCheck(s, "onepass.criteria"),
    check("onepass.conflicts", conflicts.length === 0, true, "No open conflicts remain unresolved.", conflicts),
    mustQualityCheck(s, "onepass.quality"),
  ];
}

export function evaluateGate(s: ProjectSnapshot, stage: StageId): GateStatus {
  const checks =
    stage === "plan"
      ? planChecks(s)
      : stage === "elicit"
        ? elicitChecks(s)
        : stage === "strategy"
          ? strategyChecks(s)
          : stage === "requirements"
            ? requirementsChecks(s)
            : stage === "lifecycle"
              ? lifecycleChecks(s)
              : onePassChecks(s);
  return { stage, ready: checks.every((c) => c.passed || !c.blocking), checks };
}
