// BA One Pass — server entry.
//
// A BA project holds registers (stakeholders, facts, requirements…), a
// traceability graph and versioned documents in the plugin SQLite database.
// Each session is a BB thread spawned by the plugin; bb.agents.configure gives
// it only the skills, tools and instructions of its stage.
//
// Methodology adapted from AIналитик (https://github.com/chaussky/ainalyst),
// Copyright (c) 2026 Anatoly Chaussky. Licensed under AGPL-3.0; see LICENSE
// and NOTICE.md.
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { PROJECT_CHANGED } from "./src/shared/ask";
import { sessionMetadataSchema } from "./src/shared/model";
import { STAGES, skillsForStage } from "./src/shared/stages";
import { registerRpc } from "./src/server/rpc";
import { MIGRATIONS, Store } from "./src/server/store";
import { registerTools, sessionInstructions, TOOL_NAMES } from "./src/server/tools";

export type { RpcContract } from "./src/shared/contract";

export default async function plugin(bb: BbPluginApi) {
  const db = bb.storage.database();
  bb.storage.migrate(db, MIGRATIONS);
  const store = new Store(db);
  const changed = (projectId: string) => bb.realtime.publish(PROJECT_CHANGED, { projectId });

  registerTools(bb, store, changed);
  registerRpc(bb, store, changed);

  // Only BA sessions get BA tools and skills; every other thread gets nothing
  // from this plugin. The store row wins over metadata for the stage.
  bb.agents.configure((context) => {
    const none = { tools: [], skills: [] };
    const meta = sessionMetadataSchema.safeParse(context.pluginMetadata);
    if (!meta.success) return none;
    let project;
    try {
      project = store.getProject(meta.data.projectId);
    } catch {
      return none;
    }
    const session = store.getSession(context.thread.id) ?? {
      threadId: context.thread.id,
      projectId: project.id,
      stage: meta.data.stage,
      title: "",
      status: "active" as const,
      summary: null,
      createdAt: "",
      closedAt: null,
    };
    if (session.projectId !== project.id) return none;
    return {
      tools: [...TOOL_NAMES],
      skills: skillsForStage(session.stage),
      instructions: sessionInstructions(session, project.name, STAGES[session.stage].brief),
    };
  });

  bb.log.info("BA One Pass loaded");
}
