// Section sidebar of the panel: the project list at the root, the project
// tree (overview, sessions by stage, documents, registers, traceability) inside a project.
import type { ReactNode } from "react";
import type { PluginNavPanelProps } from "@get-bb/plugin-sdk/app";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ITEM_TYPES, STAGE_IDS, type ItemType } from "../shared/model";
import { useProject, useProjects } from "./data";
import { parseRoute, type Route } from "./helpers";
import { t } from "./i18n";
import { useGo } from "./nav";
import { ErrorLine, Loading, stageLabel, typeLabel } from "./ui";

/** Registers always listed in the tree; other types appear once they have records. */
const MAIN_REGISTERS: readonly ItemType[] = [
  "stakeholder",
  "question",
  "assumption",
  "conflict",
  "goal",
  "requirement",
  "criterion",
  "risk",
  "decision",
];

export function Sidebar({ subPath }: PluginNavPanelProps) {
  const route = parseRoute(subPath);
  return (
    <div className="flex min-h-0 flex-col gap-1 overflow-y-auto px-2 py-2 text-sm">
      {route.kind === "projects" ? <ProjectList /> : <ProjectTree route={route} />}
    </div>
  );
}

function NavRow({
  active,
  icon,
  label,
  trailing,
  onClick,
  depth = 0,
}: {
  active: boolean;
  icon: string;
  label: ReactNode;
  trailing?: ReactNode;
  onClick: () => void;
  depth?: number;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className="bo-nav-item flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left"
      style={depth > 0 ? { paddingLeft: `${8 + depth * 14}px` } : undefined}
      onClick={onClick}
    >
      <Icon name={icon} className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing ?? null}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-2 pb-0.5 pt-3 text-xs font-medium text-muted-foreground">{children}</p>;
}

function Count({ n }: { n: number }) {
  return <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{n}</span>;
}

function ProjectList() {
  const projects = useProjects(false);
  const go = useGo();
  return (
    <>
      <SectionLabel>{t("projects")}</SectionLabel>
      {projects.error !== null ? <ErrorLine error={projects.error} onRetry={projects.refetch} /> : null}
      {projects.data === null ? (
        projects.error === null ? <Loading /> : null
      ) : (
        projects.data.projects.map((project) => (
          <NavRow
            key={project.id}
            active={false}
            icon="Folder"
            label={project.name}
            trailing={
              project.counts.openQuestions + project.counts.openConflicts > 0 ? (
                <Count n={project.counts.openQuestions + project.counts.openConflicts} />
              ) : undefined
            }
            onClick={() => go({ kind: "overview", projectId: project.id })}
          />
        ))
      )}
    </>
  );
}

function ProjectTree({ route }: { route: Exclude<Route, { kind: "projects" }> }) {
  const { projectId } = route;
  const project = useProject(projectId);
  const go = useGo();
  const data = project.data;

  return (
    <>
      <NavRow
        active={false}
        icon="ChevronLeft"
        label={<span className="text-muted-foreground">{t("backToProjects")}</span>}
        onClick={() => go({ kind: "projects" })}
      />
      <p className="truncate px-2 pt-2 text-sm font-medium">{data?.project.name ?? projectId}</p>
      <NavRow
        active={route.kind === "overview"}
        icon="Layers"
        label={t("overview")}
        onClick={() => go({ kind: "overview", projectId })}
      />
      {project.error !== null ? <ErrorLine error={project.error} onRetry={project.refetch} /> : null}
      {data === null ? (
        project.error === null ? <Loading /> : null
      ) : (
        <>
          <SectionLabel>{t("sessions")}</SectionLabel>
          {data.sessions.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">{t("noSessions")}</p>
          ) : (
            STAGE_IDS.map((stage) => {
              const sessions = data.sessions
                .filter((session) => session.stage === stage)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
              if (sessions.length === 0) return null;
              return (
                <div key={stage} className="flex flex-col">
                  <p className="truncate px-2 pt-1 text-xs text-muted-foreground">{stageLabel(stage)}</p>
                  {sessions.map((session) => (
                    <NavRow
                      key={session.threadId}
                      depth={1}
                      active={route.kind === "session" && route.threadId === session.threadId}
                      icon="MessageSquare"
                      label={session.title}
                      trailing={
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            session.status === "active" ? "bg-success" : "bg-muted-foreground/40",
                          )}
                          role="img"
                          aria-label={session.status === "active" ? t("sessionActive") : t("sessionClosed")}
                        />
                      }
                      onClick={() => go({ kind: "session", projectId, threadId: session.threadId })}
                    />
                  ))}
                </div>
              );
            })
          )}

          <SectionLabel>{t("documents")}</SectionLabel>
          {data.documents.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">{t("noDocuments")}</p>
          ) : (
            [...data.documents]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((document) => (
                <NavRow
                  key={document.id}
                  active={route.kind === "document" && route.documentId === document.id}
                  icon="FileText"
                  label={document.title}
                  trailing={<span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">v{document.version}</span>}
                  onClick={() => go({ kind: "document", projectId, documentId: document.id })}
                />
              ))
          )}

          <SectionLabel>{t("registers")}</SectionLabel>
          {ITEM_TYPES.filter(
            (type) => MAIN_REGISTERS.includes(type) || (data.counts.byType[type] ?? 0) > 0,
          ).map((type) => (
            <NavRow
              key={type}
              active={route.kind === "register" && route.type === type}
              icon="ListTodo"
              label={typeLabel(type)}
              trailing={<Count n={data.counts.byType[type] ?? 0} />}
              onClick={() => go({ kind: "register", projectId, type })}
            />
          ))}

          <div className="h-3" aria-hidden />
          <NavRow
            active={route.kind === "trace"}
            icon="Workflow"
            label={t("traceability")}
            onClick={() => go({ kind: "trace", projectId })}
          />
        </>
      )}
    </>
  );
}
