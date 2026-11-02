import { readdirSync, readFileSync } from "node:fs";
import { createFakePluginHost, makePluginAgentConfigurationContext } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import plugin from "../../server";
import { ALL_SKILLS, skillsForStage } from "../../src/shared/stages";
import { TOOL_NAMES } from "../../src/server/tools";

const text = (result: unknown): string => {
  if (typeof result === "string") return result;
  const r = result as { content?: { text?: string }[] };
  return (r.content ?? []).map((c) => c.text ?? "").join("\n");
};

// The icons the manifest declares, as BB would read them.
const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  bb: { branding: { experimental_icons: Record<string, string> } };
};
const declaredIcons = Object.keys(manifest.bb.branding.experimental_icons);

async function setup() {
  let spawned = 0;
  const { bb, harness } = createFakePluginHost({
    pluginId: "ba-one-pass",
    agentSkillIds: ALL_SKILLS,
    experimental_declaredIconNames: declaredIcons,
    sdk: {
      threads: {
        spawn: async () => ({ id: `thr_${++spawned}` }) as never,
        getPluginMetadata: async () => ({}),
      },
      projects: { list: async () => [{ id: "proj_1", name: "Selfy" }] as never },
    },
  });
  await plugin(bb);
  const rpc = (method: string, input: unknown) => harness.behavior.callRpc(method, input) as Promise<any>;
  return { bb, harness, rpc };
}

describe("plugin", () => {
  it("ships a SKILL.md for every stage skill", () => {
    const dirs = readdirSync(new URL("../../skills", import.meta.url));
    for (const name of ALL_SKILLS) expect(dirs).toContain(name);
  });

  it("runs a project from creation to a session with stage skills and tools", async () => {
    const { harness, rpc } = await setup();
    expect((await rpc("bb_projects_list", null)).projects).toEqual([{ id: "proj_1", name: "Selfy" }]);
    const project = await rpc("project_create", { name: "Оплата подписки", bbProjectId: "proj_1", goal: "Снизить отток" });
    expect(project.id).toBe("oplata-podpiski");

    const session = await rpc("session_start", { projectId: project.id, stage: "elicit", goal: "Интервью с CEO" });
    expect(session.threadId).toBe("thr_1");
    const spawn = harness.inspection.sdk.callsTo("threads.spawn")[0] as unknown as { args: unknown[] };
    expect(JSON.stringify(spawn)).toContain("Выявление");
    expect(JSON.stringify(spawn)).toContain('"projectId":"proj_1"');
    expect(JSON.stringify(spawn)).toContain('"visibility":"hidden"');

    // A BA session gets BA tools and the elicit skills; another thread gets nothing.
    const config = await harness.behavior.resolveAgentConfiguration(
      makePluginAgentConfigurationContext({ pluginMetadata: { projectId: project.id, stage: "elicit" }, thread: { id: "thr_1" } as never }),
    );
    expect(config.tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    expect(config.skills.sort()).toEqual(skillsForStage("elicit").sort());
    expect(config.instructions).toContain("Оплата подписки");
    const other = await harness.behavior.resolveAgentConfiguration(makePluginAgentConfigurationContext());
    expect(other.tools).toEqual([]);
    expect(other.skills).toEqual([]);

    // Tools work against the session's project.
    const ctx = { threadId: "thr_1" };
    const recorded = text(
      await harness.behavior.callAgentTool(
        "ba_record",
        {
          items: [
            { type: "stakeholder", title: "CEO", attrs: { role: "sponsor" } },
            { type: "fact", title: "Возврат в течение 14 дней", sources: [{ kind: "person", ref: "ST-1", quote: "14 дней" }] },
            { type: "requirement", kind: "business", title: "Клиент должен быстро видеть статус", priority: "must", sources: [{ kind: "item", ref: "F-1" }] },
          ],
        },
        ctx,
      ),
    );
    expect(recorded).toContain("created ST-1");
    expect(recorded).toContain("created BR-1");
    expect(recorded).toMatch(/⚠/u); // vague "быстро"

    const refused = await harness.behavior.callAgentTool("ba_record", { items: [{ type: "fact", title: "no source" }] }, ctx);
    expect(text(refused)).toMatch(/source/u);

    const context = text(await harness.behavior.callAgentTool("ba_context", {}, ctx));
    expect(context).toContain("Оплата подписки");
    expect(context).toContain("ST-1");

    const saved = text(await harness.behavior.callAgentTool("ba_document_save", { kind: "interview_notes", title: "Интервью CEO", content: "# Протокол" }, ctx));
    expect(saved).toContain("interview-notes");

    const gate = text(await harness.behavior.callAgentTool("ba_gate", {}, ctx));
    expect(gate).toMatch(/Gate elicit/u);

    const quality = text(await harness.behavior.callAgentTool("ba_check_quality", {}, ctx));
    expect(quality).toContain("BR-1");

    // Not a BA session → tool error, no crash.
    const stray = await harness.behavior.callAgentTool("ba_context", {}, { threadId: "thr_other" });
    expect(text(stray)).toMatch(/not a BA One Pass session/u);

    const overview = await rpc("project_get", { projectId: project.id });
    expect(overview.counts.byType).toMatchObject({ stakeholder: 1, fact: 1, requirement: 1 });
    expect(overview.documents.map((d: { id: string }) => d.id)).toEqual(["interview-notes"]);

    const closed = text(await harness.behavior.callAgentTool("ba_session_close", { summary: "Собрали факты" }, ctx));
    expect(closed).toContain("closed");
    expect((await rpc("sessions_list", { projectId: project.id })).sessions[0].status).toBe("closed");

    const exported = await rpc("export_markdown", { projectId: project.id });
    expect(exported.files.map((f: { path: string }) => f.path)).toContain("registers/requirement.md");
    expect(harness.realtimeSignals.length).toBeGreaterThan(0);
  });

  it("requires a reason to leave a stage with an unready gate", async () => {
    const { rpc } = await setup();
    const project = await rpc("project_create", { name: "X", bbProjectId: "proj_1" });
    await expect(rpc("stage_set", { projectId: project.id, stage: "elicit" })).rejects.toThrow();
    const moved = await rpc("stage_set", { projectId: project.id, stage: "elicit", acceptRisk: "Спонсор занят" });
    expect(moved.stage).toBe("elicit");
    const decisions = await rpc("items_list", { projectId: project.id, types: ["decision"] });
    expect(decisions.items).toHaveLength(1);
  });

  it("closes the previous question card when a new one opens", async () => {
    const { bb, harness, rpc } = await setup();
    const project = await rpc("project_create", { name: "Ask", bbProjectId: "proj_1" });
    await rpc("session_start", { projectId: project.id, stage: "plan" });
    const opened: AbortSignal[] = [];
    (bb.ui as { requestInput: unknown }).requestInput = (_request: unknown, options: { signal: AbortSignal }) =>
      new Promise((resolve, reject) => {
        opened.push(options.signal);
        options.signal.addEventListener("abort", () => reject(new Error("aborted")));
        if (opened.length === 2) resolve({ outcome: "submitted", value: { answers: [{ id: "q", answer: "Да", status: "confirmed" }] } });
      });
    const card = { title: "T", questions: [{ id: "q", question: "Верно?", why: "Проверка" }] };
    const ctx = { threadId: "thr_1" };
    const first = harness.behavior.callAgentTool("ba_ask", card, ctx);
    await new Promise((r) => setTimeout(r, 0));
    const second = await harness.behavior.callAgentTool("ba_ask", card, ctx);
    expect(text(await first)).toMatch(/replaced/u);
    expect(text(second)).toContain("→ Да");
  });
});
