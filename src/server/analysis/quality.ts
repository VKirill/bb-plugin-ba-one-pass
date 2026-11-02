// Requirement quality: ISO/IEC/IEEE 29148 characteristics scored 0–3 with
// deterministic heuristics, plus a vague-word lint for single texts.
// Adapted from AIналитик (chaussky/ainalyst), © 2026 Anatoly Chaussky, AGPL-3.0
// — skills/requirements_verify_mcp.py (signal dictionaries EN from `main`,
// RU from `ru`; _check_atomicity, _check_ambiguity, _check_testability_*,
// _check_conciseness, _check_group_b, check_req_quality).
import type { Item, ItemType } from "../../shared/model";
import { criteriaOf } from "./trace";
import { attrString, isActive, itemIndex, shortTitle, type ProjectSnapshot } from "./snapshot";

export type Characteristic =
  | "necessary"
  | "unambiguous"
  | "singular"
  | "complete"
  | "feasible"
  | "verifiable"
  | "correct"
  | "conforming"
  | "traceable";

export const CHARACTERISTICS: readonly Characteristic[] = [
  "necessary",
  "unambiguous",
  "singular",
  "complete",
  "feasible",
  "verifiable",
  "correct",
  "conforming",
  "traceable",
];

/** A score below 2 on one of these fails a quality gate. */
export const BLOCKING_CHARACTERISTICS: readonly Characteristic[] = ["necessary", "unambiguous", "singular", "verifiable"];

type Score = 0 | 1 | 2 | 3;

// ── Signal dictionaries ─────────────────────────────────────────────────

interface Signals {
  atomicity: readonly string[];
  ambiguity: readonly string[];
  implementation: readonly string[];
  measurability: readonly RegExp[];
  condition: readonly RegExp[];
}

const EN: Signals = {
  atomicity: [
    " and ", " as well as ", " plus ", " in addition ", " additionally ", " also ",
    " besides ", " moreover ", " furthermore ", " along with ", " together with ",
  ],
  ambiguity: [
    "fast", "quick", "quickly", "faster", "slow", "slowly",
    "convenient", "conveniently", "user-friendly", "user friendly", "easy", "easily", "simple",
    "good", "nice", "high-quality", "high quality", "efficient", "efficiently", "optimal", "optimally",
    "often", "rarely", "periodically", "sometimes", "usually", "as a rule", "in most cases", "frequently",
    "should try to", "if possible", "where possible", "in a timely manner", "as soon as possible",
    "as fast as possible", "if necessary", "desirable", "preferably", "recommended",
    "acceptable", "small", "large", "significant", "substantial",
    "enough", "sufficient", "adequate", "appropriate", "on time", "promptly", "without delays", "swiftly",
    "and/or", "modern", "up-to-date", "typical", "etc", "and so on", "flexible", "intuitive", "seamless",
  ],
  implementation: [
    "implement via", "implement using", "use the technology", "use the framework", "write code",
    "create a table in the database", "use rest", "use api", "call the method",
    "previously was", "historically", "in the previous version",
  ],
  measurability: [
    /\d+\s*(?:ms|s\b|sec|min|hr|hour|%|mb|gb|tb|rpm|rps|tps)/u,
    /no more than \d+/u, /no less than \d+/u, /at least \d+/u, /at most \d+/u, /up to \d+/u, /from \d+/u,
    /\d+\s*seconds?/u, /\d+\s*minutes?/u, /\d+\s*users?/u, /100\s*%/u, /0 errors/u, /\bzero\b/u, /\bfully\b/u,
    /\d+\s*requests?/u, /\d+\s*transactions?/u,
  ],
  condition: [/\bif\b/u, /\bwhen\b/u, /\bupon\b/u, /\bin case\b/u, /\bprovided that\b/u, /\bunless\b/u, /\bwhenever\b/u],
};

const RU: Signals = {
  atomicity: [
    " и ", " а также ", " а так же ", " а ещё ", " а еще ", " плюс к этому ",
    " кроме того ", " помимо этого ", " вдобавок ", " одновременно с ", " вместе с тем ",
  ],
  ambiguity: [
    "быстро", "быстрый", "быстрая", "быстрое", "быстрее", "медленно", "медленный",
    "удобно", "удобный", "удобная", "удобное", "удобен",
    "легко", "легкий", "лёгкий", "легкая", "лёгкая", "хорошо", "хороший", "хорошая", "хорошее",
    "качественно", "качественный", "эффективно", "эффективный", "оптимально", "оптимальный",
    "часто", "редко", "периодически", "иногда", "обычно", "как правило", "в большинстве случаев", "зачастую",
    "должен стараться", "по возможности", "по мере возможности", "в разумные сроки", "в кратчайшие сроки",
    "максимально быстро", "при необходимости", "желательно", "предпочтительно", "рекомендуется",
    "допустимо", "допускается", "небольшой", "крупный", "значительный", "существенный",
    "достаточно", "достаточный", "адекватный", "приемлемый", "вовремя", "своевременно", "без задержек",
    "оперативно", "и/или", "современный", "актуальный", "стандартный", "типовой",
    "и т. д.", "и т.д.", "и т. п.", "и т.п.", "интуитивно", "гибкий", "удобство",
  ],
  implementation: [
    "реализовать через", "реализовать с помощью", "использовать технологию", "использовать фреймворк",
    "написать код", "создать таблицу в базе", "использовать rest", "использовать api", "вызвать метод",
    "ранее было", "исторически", "в предыдущей версии",
  ],
  measurability: [
    /\d+\s*(?:мс|ms|с(?![\p{L}])|сек|мин|час|%|мб|гб|тб|rpm|rps|tps)/u,
    /не более \d+/u, /не менее \d+/u, /до \d+/u, /от \d+/u, /\d+\s*секунд/u, /\d+\s*минут/u,
    /\d+\s*пользовател/u, /100\s*%/u, /0 ошибок/u, /нулевой/u, /полностью/u, /\d+\s*запрос/u, /\d+\s*транзакц/u,
  ],
  condition: [/(?<![\p{L}])если\s/u, /(?<![\p{L}])когда\s/u, /(?<![\p{L}])при\s/u, /в случае\s/u, /при условии\s/u],
};

function signalsFor(language: string): Signals[] {
  // Russian texts often mix English words, so RU checks both dictionaries.
  return language.toLowerCase().startsWith("ru") ? [RU, EN] : [EN];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Whole-word match (unicode letters), unlike the substring match of the original. */
function containsWord(text: string, word: string): boolean {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, "u");
  return pattern.test(text);
}

function findAmbiguous(text: string, language: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const signals of signalsFor(language)) {
    for (const word of signals.ambiguity) if (containsWord(lower, word)) found.add(word);
  }
  return [...found];
}

function findCompound(text: string, language: string): string[] {
  const padded = ` ${text.toLowerCase().replace(/\s+/gu, " ")} `;
  const found: string[] = [];
  for (const signals of signalsFor(language)) {
    for (const signal of signals.atomicity) {
      let index = padded.indexOf(signal);
      while (index !== -1) {
        found.push(signal.trim());
        index = padded.indexOf(signal, index + signal.length - 1);
      }
    }
  }
  return found;
}

function findImplementation(text: string, language: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const signals of signalsFor(language)) {
    for (const signal of signals.implementation) if (lower.includes(signal)) found.add(signal);
  }
  return [...found];
}

function hasMeasure(text: string, language: string): boolean {
  const lower = text.toLowerCase();
  return signalsFor(language).some((signals) => signals.measurability.some((pattern) => pattern.test(lower)));
}

function hasCondition(text: string, language: string): boolean {
  const lower = ` ${text.toLowerCase()}`;
  return signalsFor(language).some((signals) => signals.condition.some((pattern) => pattern.test(lower)));
}

/** Short warnings for one text (title + body of a requirement, rule, criterion or goal). */
export function lintText(text: string, language: string): string[] {
  const warnings: string[] = [];
  const vague = findAmbiguous(text, language);
  if (vague.length > 0) {
    warnings.push(`Vague wording without a measure: ${vague.slice(0, 5).map((w) => `"${w}"`).join(", ")}`);
  }
  const compound = findCompound(text, language);
  if (compound.length >= 2) {
    warnings.push(`Possibly compound (${compound.length} conjunctions: ${[...new Set(compound)].join(", ")}) — split into single requirements`);
  }
  const implementation = findImplementation(text, language);
  if (implementation.length > 0) {
    warnings.push(`Describes implementation, not need: ${implementation.slice(0, 2).map((w) => `"${w}"`).join(", ")}`);
  }
  if (text.length > 950) warnings.push(`Long text (${text.length} chars) — the requirement may be compound`);
  return warnings;
}

// ── Per-item scoring ────────────────────────────────────────────────────

interface ItemQuality {
  id: string;
  scores: Record<Characteristic, Score>;
  issues: { characteristic: Characteristic; message: string }[];
}

const NECESSITY_TARGETS: ReadonlySet<ItemType> = new Set<ItemType>(["goal", "need", "gap", "cause"]);

function scoreItem(s: ProjectSnapshot, item: Item, language: string): ItemQuality {
  const index = itemIndex(s);
  const text = `${item.title} ${item.body}`.trim();
  const issues: ItemQuality["issues"] = [];
  const outgoing = s.links.filter((link) => link.from === item.id);
  const incoming = s.links.filter((link) => link.to === item.id);

  // necessary — the item serves a goal / need (requirements), or verifies something (criteria).
  let necessary: Score;
  if (item.type === "criterion") {
    necessary = outgoing.some((link) => link.relation === "verifies") ? 3 : 0;
    if (necessary === 0) issues.push({ characteristic: "necessary", message: "Criterion verifies nothing — link it with `verifies`." });
  } else {
    const servesTarget = outgoing.some(
      (link) =>
        ["derives_from", "satisfies", "addresses"].includes(link.relation) &&
        NECESSITY_TARGETS.has(index.get(link.to)?.type ?? "term"),
    );
    const derived = outgoing.some((link) => ["derives_from", "satisfies", "addresses", "refines"].includes(link.relation));
    necessary = servesTarget ? 3 : derived ? 2 : item.sources.length > 0 ? 1 : 0;
    if (necessary < 2) issues.push({ characteristic: "necessary", message: "Not traced to a goal or need — why is it needed?" });
  }

  // unambiguous — no vague words.
  const vague = findAmbiguous(text, language);
  const unambiguous: Score = vague.length === 0 ? 3 : vague.length === 1 ? 1 : 0;
  if (vague.length > 0) {
    issues.push({ characteristic: "unambiguous", message: `Vague words: ${vague.slice(0, 5).map((w) => `"${w}"`).join(", ")}` });
  }

  // singular — one thought; ≥2 conjunction signals = compound (one may be a list of values).
  const compound = findCompound(text, language);
  const singular: Score = compound.length >= 2 ? 0 : compound.length === 1 ? 2 : 3;
  if (compound.length >= 2) {
    issues.push({ characteristic: "singular", message: `Compound: ${compound.length} conjunctions — split it.` });
  }

  // complete — statement, source/trace and owner.
  const hasBody = item.body.trim().length > 0;
  const hasTrace = item.sources.length > 0 || outgoing.length + incoming.length > 0;
  const hasOwner = (item.owner ?? "").trim() !== "";
  const complete: Score = hasBody && hasTrace && hasOwner ? 3 : hasBody && hasTrace ? 2 : hasBody || hasTrace ? 1 : 0;
  if (!hasBody) issues.push({ characteristic: "complete", message: "No statement text beyond the title." });
  if (!hasOwner) issues.push({ characteristic: "complete", message: "No owner — who answers for it?" });

  // feasible — cannot be proven by rules; flag conflicts with constraints.
  const conflictsConstraint = [...outgoing, ...incoming].some((link) => {
    if (link.relation !== "conflicts_with") return false;
    const other = index.get(link.from === item.id ? link.to : link.from);
    return other?.type === "constraint";
  });
  const feasible: Score = conflictsConstraint ? 0 : 2;
  if (conflictsConstraint) issues.push({ characteristic: "feasible", message: "Conflicts with a constraint." });

  // verifiable — a criterion, a fit criterion or a measurable statement.
  let verifiable: Score;
  if (item.type === "criterion") {
    const gwt = ["given", "when", "then"].every((key) => attrString(item, key) !== "");
    const gwtText = /(given|дано)[\s\S]*(when|когда)[\s\S]*(then|тогда)/iu.test(text);
    verifiable = gwt ? 3 : gwtText ? 2 : 0;
    if (verifiable === 0) issues.push({ characteristic: "verifiable", message: "Not in Given / When / Then form." });
  } else if (item.type === "rule") {
    verifiable = hasCondition(text, language) ? 3 : 2;
    if (verifiable === 2) issues.push({ characteristic: "verifiable", message: "Rule without an explicit condition — is it clear when it applies?" });
  } else {
    const criteria = criteriaOf(s, item.id).length;
    const fit = attrString(item, "fit_criterion") !== "";
    const measurable = hasMeasure(text, language);
    verifiable = criteria > 0 ? 3 : fit || measurable ? 2 : 0;
    if (verifiable === 0) {
      issues.push({
        characteristic: "verifiable",
        message: "No acceptance criterion, fit criterion or measurable value.",
      });
    }
  }

  // correct — not contradicted by an open conflict.
  const openConflict = s.items.some(
    (other) =>
      other.type === "conflict" &&
      other.status === "open" &&
      s.links.some((link) => (link.from === other.id && link.to === item.id) || (link.to === other.id && link.from === item.id)),
  );
  const correct: Score = openConflict ? 1 : 2;
  if (openConflict) issues.push({ characteristic: "correct", message: "An open conflict involves it." });

  // conforming — form: kind, priority, concise, no implementation detail.
  const implementation = findImplementation(text, language);
  const conformIssues: string[] = [];
  if (item.type === "requirement" && item.kind === null) conformIssues.push("no requirement kind");
  if (item.type === "requirement" && item.priority === null) conformIssues.push("no priority");
  if (item.title.length > 150) conformIssues.push(`title ${item.title.length} chars (≤150)`);
  if (item.body.length > 800) conformIssues.push(`body ${item.body.length} chars (≤800)`);
  if (implementation.length > 0) conformIssues.push(`implementation wording: ${implementation.slice(0, 2).join(", ")}`);
  const conforming: Score = implementation.length > 0 ? 1 : conformIssues.length > 0 ? 2 : 3;
  if (conformIssues.length > 0) issues.push({ characteristic: "conforming", message: conformIssues.join("; ") });

  // traceable — sources and links.
  const hasLinks = outgoing.length + incoming.length > 0;
  const traceable: Score = item.sources.length > 0 && hasLinks ? 3 : item.sources.length > 0 || hasLinks ? 2 : 0;
  if (traceable === 0) issues.push({ characteristic: "traceable", message: "No source and no links — isolated." });

  return {
    id: item.id,
    scores: { necessary, unambiguous, singular, complete, feasible, verifiable, correct, conforming, traceable },
    issues,
  };
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function checkQuality(
  s: ProjectSnapshot,
  opts: { ids?: string[]; types?: ItemType[] } = {},
): {
  markdown: string;
  results: ItemQuality[];
  setIssues: string[];
} {
  const types = opts.types ?? ["requirement", "rule", "criterion"];
  const selected =
    opts.ids !== undefined && opts.ids.length > 0
      ? s.items.filter((item) => opts.ids?.includes(item.id))
      : s.items.filter((item) => types.includes(item.type) && isActive(item));
  const language = s.project.language;
  const results = selected.map((item) => scoreItem(s, item, language));

  // Set-level checks (29148 §5.2.6): duplicates, Must inflation, missing priorities.
  const setIssues: string[] = [];
  const requirements = s.items.filter((item) => item.type === "requirement" && isActive(item));
  const byTitle = new Map<string, string[]>();
  for (const req of requirements) {
    const key = normalise(req.title);
    if (key === "") continue;
    byTitle.set(key, [...(byTitle.get(key) ?? []), req.id]);
  }
  for (const ids of byTitle.values()) if (ids.length > 1) setIssues.push(`Duplicate requirements: ${ids.join(", ")}`);
  const prioritised = requirements.filter((req) => req.priority !== null);
  const must = prioritised.filter((req) => req.priority === "must");
  if (prioritised.length >= 3 && must.length / prioritised.length > 0.6) {
    setIssues.push(`Must inflation: ${must.length} of ${prioritised.length} prioritised requirements are Must (>60%).`);
  }
  const unprioritised = requirements.filter((req) => req.priority === null).map((req) => req.id);
  if (unprioritised.length > 0) setIssues.push(`Requirements without priority: ${unprioritised.slice(0, 20).join(", ")}`);
  const index = itemIndex(s);
  for (const req of requirements) {
    for (const link of s.links) {
      if (link.from === req.id && link.relation === "conflicts_with" && index.get(link.to)?.type === "requirement") {
        setIssues.push(`Conflicting requirements: ${req.id} ↔ ${link.to}`);
      }
    }
  }

  const lines: string[] = ["## Quality check (ISO/IEC/IEEE 29148)", ""];
  if (results.length === 0) {
    lines.push("No items to check.");
  } else {
    const failing = results.filter((result) => BLOCKING_CHARACTERISTICS.some((c) => result.scores[c] < 2));
    lines.push(
      `${results.length} item(s) checked, ${failing.length} fail a blocking characteristic (${BLOCKING_CHARACTERISTICS.join(", ")} < 2).`,
      "",
      "| Item | Nec | Unamb | Sing | Compl | Feas | Verif | Corr | Conf | Trace |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const result of results) {
      lines.push(`| ${result.id} | ${CHARACTERISTICS.map((c) => result.scores[c]).join(" | ")} |`);
    }
    const withIssues = results.filter((result) => result.issues.length > 0);
    if (withIssues.length > 0) {
      lines.push("", "### Issues");
      for (const result of withIssues) {
        const item = index.get(result.id);
        lines.push(`- **${result.id}** ${item ? shortTitle(item.title, 60) : ""}`);
        for (const issue of result.issues) lines.push(`  - ${issue.characteristic}: ${issue.message}`);
      }
    }
  }
  if (setIssues.length > 0) lines.push("", "### Set-level", ...setIssues.map((issue) => `- ${issue}`));
  lines.push("", "_Feasibility and correctness are heuristic; confirm them with the stakeholders._");
  return { markdown: lines.join("\n"), results, setIssues };
}
