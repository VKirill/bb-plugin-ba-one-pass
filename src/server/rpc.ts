// RPC handlers for the app.
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { rpcContract, type ProjectCounts } from "../shared/contract";
import type { StageId } from "../shared/model";
import { evaluateGate, traceMatrix } from "./analysis";
import { renderExport } from "./render";
import type { Store } from "./store";
import { sessionTitle } from "./tools";

const STAGE_LABELS: Record<string, Record<StageId, string>> = {
  ru: {
    plan: "Рамка и план",
    elicit: "Выявление",
    strategy: "Анализ стратегии",
    requirements: "Требования и решение",
    lifecycle: "Жизненный цикл требований",
    "one-pass": "One Pass",
  },
  en: {
    plan: "Frame and plan",
    elicit: "Elicitation",
    strategy: "Strategy analysis",
    requirements: "Requirements and design",
    lifecycle: "Requirements life cycle",
    "one-pass": "One Pass",
  },
};

/** The first user message of a new session, in the project language. */
export function kickoffPrompt(project: { name: string; language: string }, stage: StageId, goal: string | undefined): string {
  const ru = project.language.toLowerCase().startsWith("ru");
  const label = (ru ? STAGE_LABELS.ru : STAGE_LABELS.en)![stage];
  if (ru) {
    return [
      `Начинаем сессию «${label}» по проекту «${project.name}».`,
      goal ? `Цель сессии: ${goal}` : "Цель сессии предложи сам по состоянию проекта.",
      "Начни с обзора проекта и скажи, с чего предлагаешь начать.",
    ].join("\n");
  }
  return [
    `Let's start a "${label}" session for the project "${project.name}".`,
    goal ? `Session goal: ${goal}` : "Propose the session goal from the project state.",
    "Start by reviewing the project and tell me where you suggest we begin.",
  ].join("\n");
}

export function registerRpc(bb: BbPluginApi, store: Store, changed: (projectId: string) => void): void {
  function counts(projectId: string): ProjectCounts {
    const sessions = store.listSessions(projectId);
    return {
      sessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === "active").length,
      documents: store.listDocuments(projectId).length,
      requirements: store.countWhere(projectId, "requirement", ["draft", "verified", "validated", "approved"]),
      openQuestions: store.countWhere(projectId, "question", ["open"]),
      openConflicts: store.countWhere(projectId, "conflict", ["open"]),
      openAssumptions: store.countWhere(projectId, "assumption", ["open"]),
      byType: store.countsByType(projectId),
    };
  }

  const userCtx = { stage: null, sessionId: null } as const;

  bb.rpc.register(rpcContract, {
    projects_list: ({ includeArchived }) => ({
      projects: store.listProjects(includeArchived === true).map((p) => ({ ...p, counts: counts(p.id) })),
    }),

    bb_projects_list: async () => {
      const projects = await bb.sdk.projects.list();
      return { projects: projects.map((p) => ({ id: p.id, name: p.name })) };
    },

    project_create: (input) => {
      const project = store.createProject({ ...input, stage: input.startStage });
      changed(project.id);
      return project;
    },

    project_update: ({ projectId, ...patch }) => {
      const project = store.updateProject(projectId, patch);
      changed(projectId);
      return project;
    },

    project_get: ({ projectId }) => {
      const s = store.snapshot(projectId);
      return {
        project: s.project,
        counts: counts(projectId),
        sessions: s.sessions,
        documents: s.documents,
        gate: evaluateGate(s, s.project.stage),
      };
    },

    gate_get: ({ projectId, stage }) => evaluateGate(store.snapshot(projectId), stage),

    stage_set: ({ projectId, stage, acceptRisk }) => {
      const s = store.snapshot(projectId);
      const gate = evaluateGate(s, s.project.stage);
      if (!gate.ready) {
        if (acceptRisk === undefined || acceptRisk.trim() === "") {
          throw new Error(`The ${s.project.stage} gate is not ready; give a reason to go on anyway.`);
        }
        store.upsertItems(
          projectId,
          [
            {
              type: "decision",
              title: `Move from ${s.project.stage} to ${stage} with an unready gate`,
              body: acceptRisk,
              sources: [{ kind: "person", ref: "user (BA One Pass panel)" }],
            },
          ],
          userCtx,
        );
      }
      const project = store.updateProject(projectId, { stage });
      changed(projectId);
      return project;
    },

    session_start: async ({ projectId, stage, goal }) => {
      const project = store.getProject(projectId);
      const title = sessionTitle(project.name, stage);
      const thread = await bb.sdk.threads.spawn({
        projectId: project.bbProjectId,
        environment: { type: "project-default" },
        prompt: kickoffPrompt(project, stage, goal),
        title,
        pluginMetadata: { projectId: project.id, stage },
      });
      const session = store.addSession({ threadId: thread.id, projectId, stage, title });
      changed(projectId);
      return session;
    },

    session_close: ({ threadId, summary }) => {
      const session = store.closeSession(threadId, summary ?? null);
      changed(session.projectId);
      return session;
    },

    sessions_list: ({ projectId }) => ({ sessions: store.listSessions(projectId) }),

    documents_list: ({ projectId }) => ({ documents: store.listDocuments(projectId) }),

    document_get: ({ projectId, id, version }) => store.getDocument(projectId, id, version),

    document_versions: ({ projectId, id }) => ({ versions: store.documentVersions(projectId, id) }),

    document_update: ({ projectId, id, content, status, note }) => {
      const doc = store.updateDocument(projectId, id, { content, status, note: note ?? (status === "approved" ? "Approved by the user" : "Edited by the user") }, userCtx);
      changed(projectId);
      return doc;
    },

    items_list: ({ projectId, types, status, query }) => ({ items: store.listItems(projectId, { types, status, query }) }),

    item_get: ({ projectId, id }) => {
      const item = store.getItem(projectId, id);
      if (item === null) throw new Error(`No item ${id}.`);
      const links = store.listLinks(projectId);
      const title = (ref: string) => store.getItem(projectId, ref)?.title ?? ref;
      return {
        item,
        outgoing: links.filter((l) => l.from === id).map((l) => ({ ...l, title: title(l.to) })),
        incoming: links.filter((l) => l.to === id).map((l) => ({ ...l, title: title(l.from) })),
        history: store.itemHistory(projectId, id),
      };
    },

    trace_matrix: ({ projectId, from, to }) => traceMatrix(store.snapshot(projectId), from, to),

    export_markdown: ({ projectId }) => {
      const s = store.snapshot(projectId);
      const docs = s.documents.map((d) => {
        const full = store.getDocument(projectId, d.id);
        return { id: d.id, title: d.title, content: full.content };
      });
      return { files: renderExport(s, docs) };
    },
  });
}
