// Pure helpers of the app: routes, item-id links, table of contents, ask
// payload parsing, export bundle. No React, no SDK — unit-tested in tests/app.
import { ITEM_TYPES, type ItemType } from "../shared/model";
import { ASK_RENDERER_ID, PROJECT_CHANGED } from "../shared/ask";

export const PROJECT_CHANGED_CHANNEL = PROJECT_CHANGED;
export const ASK_RENDERER = ASK_RENDERER_ID;

export const PANEL_PATH = "ba";

// ── Routes ───────────────────────────────────────────────────────────────

export type Route =
  | { kind: "projects" }
  | { kind: "overview"; projectId: string }
  | { kind: "session"; projectId: string; threadId: string }
  | { kind: "document"; projectId: string; documentId: string }
  | { kind: "register"; projectId: string; type: ItemType }
  | { kind: "trace"; projectId: string };

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function parseRoute(subPath: string): Route {
  const parts = subPath.split("/").filter((part) => part !== "").map(decode);
  if (parts[0] !== "p" || parts[1] === undefined) return { kind: "projects" };
  const projectId = parts[1];
  const [section, value] = [parts[2], parts[3]];
  if (section === "s" && value !== undefined) return { kind: "session", projectId, threadId: value };
  if (section === "d" && value !== undefined) return { kind: "document", projectId, documentId: value };
  if (section === "r" && value !== undefined && (ITEM_TYPES as readonly string[]).includes(value)) {
    return { kind: "register", projectId, type: value as ItemType };
  }
  if (section === "trace") return { kind: "trace", projectId };
  return { kind: "overview", projectId };
}

/** Unencoded subPath for useBbNavigate().toPluginPanel (BB encodes segments). */
export function routePath(route: Route): string {
  switch (route.kind) {
    case "projects":
      return "";
    case "overview":
      return `p/${route.projectId}`;
    case "session":
      return `p/${route.projectId}/s/${route.threadId}`;
    case "document":
      return `p/${route.projectId}/d/${route.documentId}`;
    case "register":
      return `p/${route.projectId}/r/${route.type}`;
    case "trace":
      return `p/${route.projectId}/trace`;
  }
}

export function routeProjectId(route: Route): string | null {
  return route.kind === "projects" ? null : route.projectId;
}

// ── Item ids in Markdown ──────────────────────────────────────────────────

export const ITEM_ID_PATTERN =
  /\b(ST|SRC|F|Q|ASM|CON|D|BN|G|SE|RC|GAP|CN|R|BR|SR|FR|NFR|TR|RULE|SC|AC|OPT|CR|VI|GL)-\d+\b/gu;

/** Href marker the document reader intercepts to open an item. */
export const ITEM_LINK_PREFIX = "#ba-item:";

function linkifyPlain(text: string): string {
  return text.replace(ITEM_ID_PATTERN, (id) => `[${id}](${ITEM_LINK_PREFIX}${id})`);
}

/** Split a line into code spans, existing links/images and plain text; link ids only in plain text. */
function linkifyLine(line: string): string {
  const protectedPattern = /(`+)[\s\S]*?\1|!?\[[^\]]*\]\([^)]*\)|<[^>\n]+>|https?:\/\/\S+/gu;
  let result = "";
  let last = 0;
  for (const match of line.matchAll(protectedPattern)) {
    const start = match.index ?? 0;
    result += linkifyPlain(line.slice(last, start)) + match[0];
    last = start + match[0].length;
  }
  return result + linkifyPlain(line.slice(last));
}

/** Turn register ids (BR-3, Q-12…) into links, outside fenced code, code spans and existing links. */
export function linkifyItemIds(markdown: string): string {
  let fence: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/u.exec(line);
      if (fenceMatch) {
        const marker = fenceMatch[1] as string;
        if (fence === null) fence = marker[0] as string;
        else if (marker[0] === fence) fence = null;
        return line;
      }
      if (fence !== null) return line;
      // Headings stay plain so the table of contents matches the rendered text.
      if (/^\s{0,3}#{1,6}\s/u.test(line)) return line;
      return linkifyLine(line);
    })
    .join("\n");
}

// ── Table of contents ─────────────────────────────────────────────────────

export interface TocEntry {
  level: number;
  text: string;
  /** Order among headings, used to find the rendered element. */
  index: number;
}

/** ATX headings outside fenced code, without inline Markdown marks. */
export function extractToc(markdown: string, maxLevel = 3): TocEntry[] {
  const entries: TocEntry[] = [];
  let fence: string | null = null;
  let index = 0;
  for (const line of markdown.split("\n")) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/u.exec(line);
    if (fenceMatch) {
      const marker = (fenceMatch[1] as string)[0] as string;
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    if (!heading) continue;
    const level = (heading[1] as string).length;
    const text = (heading[2] as string)
      .replace(/!?\[([^\]]*)\]\([^)]*\)/gu, "$1")
      .replace(/[`*_~]/gu, "")
      .trim();
    if (level <= maxLevel && text !== "") entries.push({ level, text, index });
    index += 1;
  }
  return entries;
}

// ── ba_ask payload ────────────────────────────────────────────────────────

export interface AskOption {
  label: string;
  description?: string;
  recommended?: boolean;
}
export interface AskQuestion {
  id: string;
  question: string;
  why?: string;
  options: AskOption[];
  allowFreeText: boolean;
  allowUnknown: boolean;
}
export interface AskPayloadView {
  title: string;
  questions: AskQuestion[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Defensive read of askPayloadSchema (the payload is untrusted JSON). */
export function parseAskPayload(payload: unknown): AskPayloadView | null {
  if (!isRecord(payload) || typeof payload.title !== "string" || !Array.isArray(payload.questions)) {
    return null;
  }
  const questions: AskQuestion[] = [];
  for (const raw of payload.questions.slice(0, 3)) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.question !== "string") return null;
    const options: AskOption[] = Array.isArray(raw.options)
      ? raw.options.filter(isRecord).flatMap((option) =>
          typeof option.label === "string"
            ? [
                {
                  label: option.label,
                  ...(optionalString(option.description) ? { description: option.description as string } : {}),
                  ...(option.recommended === true ? { recommended: true } : {}),
                },
              ]
            : [],
        )
      : [];
    const why = optionalString(raw.why);
    questions.push({
      id: raw.id,
      question: raw.question,
      ...(why ? { why } : {}),
      options,
      // Without options the only way to answer is free text.
      allowFreeText: raw.allow_free_text === true || options.length === 0,
      allowUnknown: raw.allow_unknown !== false,
    });
  }
  if (questions.length === 0) return null;
  return { title: payload.title, questions };
}

export type AskChoice =
  | { kind: "option"; index: number }
  | { kind: "text"; text: string }
  | { kind: "unknown" }
  | { kind: "none" };

/** A type alias (not an interface) so it is assignable to the SDK's JsonValue. */
export type AskAnswerOut = {
  id: string;
  answer: string;
  status: "confirmed" | "overridden" | "unknown" | "skipped";
};

/** Build askResponseSchema answers from the user's choices. */
export function buildAskAnswers(
  questions: readonly AskQuestion[],
  choices: Readonly<Record<string, AskChoice>>,
): AskAnswerOut[] {
  return questions.map((question) => {
    const choice = choices[question.id] ?? { kind: "none" };
    switch (choice.kind) {
      case "option": {
        const option = question.options[choice.index];
        if (option === undefined) return { id: question.id, answer: "", status: "skipped" };
        return {
          id: question.id,
          answer: option.label,
          status: option.recommended === true ? "confirmed" : "overridden",
        };
      }
      case "text":
        return choice.text.trim() === ""
          ? { id: question.id, answer: "", status: "skipped" }
          : { id: question.id, answer: choice.text.trim(), status: "overridden" };
      case "unknown":
        return { id: question.id, answer: "", status: "unknown" };
      case "none":
        return { id: question.id, answer: "", status: "skipped" };
    }
  });
}

// ── Export ────────────────────────────────────────────────────────────────

/** One Markdown file from export_markdown's files, each under a file marker. */
export function bundleExport(projectName: string, files: ReadonlyArray<{ path: string; content: string }>): string {
  const parts = [`# ${projectName}`, ""];
  for (const file of files) {
    parts.push(`<!-- file: ${file.path} -->`, "", file.content.trimEnd(), "", "---", "");
  }
  return parts.join("\n");
}

export function exportFileName(projectId: string, now = new Date()): string {
  return `${projectId}-${now.toISOString().slice(0, 10)}.md`;
}
