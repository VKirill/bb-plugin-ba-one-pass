import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PATH_STAGES, STAGE_IDS, type GateStatus, type StageId } from "../../shared/model";
import { STAGES } from "../../shared/stages";
import { errorText, useBaRpc, useProject, useQuery } from "../data";
import { t, tMaybe } from "../i18n";
import { ItemDialog } from "../ItemDialog";
import { useGo } from "../nav";
import { useExport } from "../useExport";
import {
  DocStatusPill,
  EmptyState,
  ErrorLine,
  Field,
  Loading,
  NativeSelect,
  Panel,
  Pill,
  stageLabel,
  StatusPill,
  Strip,
  TextArea,
  typeLabel,
} from "../ui";
import { cn } from "@/lib/utils";

export function OverviewPage({ projectId }: { projectId: string }) {
  const query = useProject(projectId);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [stageDialog, setStageDialog] = useState(false);
  const go = useGo();
  const data = query.data;
  const exporter = useExport(projectId, data?.project.name ?? projectId);

  if (data === null) {
    return query.error === null ? <Loading /> : <ErrorLine error={query.error} onRetry={query.refetch} />;
  }
  const { project, counts, sessions, documents, gate } = data;
  const recentDocuments = [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const recentSessions = [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <Strip
        title={project.name}
        meta={
          <>
            {project.product === "" ? null : <span>{project.product}</span>}
            <Pill tone="info">{stageLabel(project.stage)}</Pill>
            {project.sensitive ? (
              <Pill tone="warning">
                <Icon name="Lock" className="size-3" aria-hidden />
                {t("sensitive")}
              </Pill>
            ) : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" className="bo-raised" onClick={() => setStageDialog(true)}>
              {t("changeStage")}
            </Button>
            <Button variant="outline" className="bo-raised" disabled={exporter.pending} onClick={() => void exporter.run()}>
              <Icon name="Download" className="size-4" aria-hidden />
              {exporter.pending ? t("exporting") : t("export")}
            </Button>
          </>
        }
      />
      {project.sensitive ? <p className="text-xs text-muted-foreground">{t("sensitiveHint")}</p> : null}
      {project.goal === "" ? null : <p className="text-sm">{project.goal}</p>}

      <StageStepper current={project.stage} />

      <NextStepCard
        key={project.stage}
        projectId={projectId}
        stage={project.stage}
        onStarted={(threadId) => go({ kind: "session", projectId, threadId })}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GatePanel gate={gate} onOpenItem={setOpenItem} />
        <OpenItemsPanel projectId={projectId} onOpenItem={setOpenItem} />
        <Panel title={t("recentDocuments")} count={counts.documents}>
          {recentDocuments.length === 0 ? (
            <EmptyState title={t("noDocuments")} />
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {recentDocuments.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    className="flex w-full min-w-0 items-center gap-2 py-2 text-left text-sm hover:text-foreground"
                    onClick={() => go({ kind: "document", projectId, documentId: document.id })}
                  >
                    <Icon name="FileText" className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{document.title}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">v{document.version}</span>
                    <DocStatusPill status={document.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("sessions")} count={counts.sessions}>
          {recentSessions.length === 0 ? (
            <EmptyState title={t("noSessions")} />
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {recentSessions.map((session) => (
                <li key={session.threadId}>
                  <button
                    type="button"
                    className="flex w-full min-w-0 items-center gap-2 py-2 text-left text-sm"
                    onClick={() => go({ kind: "session", projectId, threadId: session.threadId })}
                  >
                    <Icon name="MessageSquare" className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{session.title}</span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{stageLabel(session.stage)}</span>
                    <Pill tone={session.status === "active" ? "info" : "muted"}>
                      {session.status === "active" ? t("sessionActive") : t("sessionClosed")}
                    </Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <ChangeStageDialog
        open={stageDialog}
        onOpenChange={setStageDialog}
        projectId={projectId}
        current={project.stage}
      />
      <ItemDialog projectId={projectId} itemId={openItem} onClose={() => setOpenItem(null)} onOpenItem={setOpenItem} />
    </div>
  );
}

function StageStepper({ current }: { current: StageId }) {
  const index = (PATH_STAGES as readonly string[]).indexOf(current);
  return (
    <nav aria-label={t("currentStage")} className="flex flex-col gap-2">
      <ol className="flex flex-wrap items-center gap-1.5">
        {PATH_STAGES.map((stage, position) => {
          const done = index >= 0 && position < index;
          const active = stage === current;
          return (
            <li key={stage} className="flex items-center gap-1.5">
              {position === 0 ? null : <Icon name="ChevronRight" className="size-3.5 text-muted-foreground" aria-hidden />}
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs",
                  active ? "bo-raised font-medium" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full font-mono text-[10px] tabular-nums",
                    done ? "bg-primary text-primary-foreground" : active ? "bg-foreground text-background" : "bg-muted",
                  )}
                  aria-hidden
                >
                  {done ? "✓" : position}
                </span>
                {stageLabel(stage)}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{t("sideModes")}:</span>
        {(["lifecycle", "one-pass"] as const).map((stage) => (
          <Pill key={stage} tone={stage === current ? "info" : "neutral"}>
            {stageLabel(stage)}
          </Pill>
        ))}
      </div>
    </nav>
  );
}

function NextStepCard({
  projectId,
  stage,
  onStarted,
}: {
  projectId: string;
  stage: StageId;
  onStarted: (threadId: string) => void;
}) {
  const rpc = useBaRpc();
  const [sessionStage, setSessionStage] = useState<StageId>(stage);
  const [goal, setGoal] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const definition = STAGES[sessionStage];

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      const session = await rpc.call("session_start", {
        projectId,
        stage: sessionStage,
        ...(goal.trim() === "" ? {} : { goal: goal.trim() }),
      });
      setGoal("");
      onStarted(session.threadId);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="bo-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bo-tile size-8">
          <Icon name="ArrowRight" fallback="ChevronRight" className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">{t("nextStep")}</h2>
          <p className="text-xs text-muted-foreground">{t("nextStepStart", { stage: stageLabel(sessionStage) })}</p>
        </div>
        <NativeSelect
          aria-label={t("targetStage")}
          className="w-auto"
          value={sessionStage}
          onChange={(event) => setSessionStage(event.target.value as StageId)}
        >
          {STAGE_IDS.map((id) => (
            <option key={id} value={id}>
              {stageLabel(id)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Field label={t("sessionGoal")} htmlFor="bo-session-goal">
        <TextArea
          id="bo-session-goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder={t("sessionGoalPlaceholder")}
          maxLength={4000}
          className="min-h-16"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="bo-accent" disabled={pending} onClick={() => void start()}>
          <Icon name="MessageCirclePlus" className="size-4" aria-hidden />
          {pending ? t("starting") : t("startSession")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("chapter", { n: definition.chapters })} · {t("stageSkills")}:{" "}
          <span className="font-mono">{["ba-core", ...definition.skills].join(", ")}</span>
        </span>
      </div>
      {error !== null ? <ErrorLine error={error} /> : null}
    </section>
  );
}

function GatePanel({ gate, onOpenItem }: { gate: GateStatus; onOpenItem: (id: string) => void }) {
  return (
    <Panel
      title={`${t("gate")} · ${stageLabel(gate.stage)}`}
      actions={<Pill tone={gate.ready ? "success" : "warning"}>{gate.ready ? t("gateReady") : t("gateNotReady")}</Pill>}
    >
      {gate.checks.length === 0 ? (
        <EmptyState title={t("gateEmpty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {gate.checks.map((check) => (
            <li key={check.id} className="flex min-w-0 items-start gap-2 text-sm">
              <Icon
                name={check.passed ? "CircleCheck" : "AlertCircle"}
                className={cn("mt-0.5 size-4 shrink-0", check.passed ? "bo-text-success" : check.blocking ? "bo-text-danger" : "bo-text-warning")}
                aria-label={check.passed ? t("gateReady") : t("gateNotReady")}
              />
              <div className="min-w-0 flex-1">
                <p className="break-words">
                  {tMaybe(`gate_${check.id}`, check.detail)}
                  {!check.passed && check.blocking ? (
                    <Pill tone="danger" className="ml-1.5">
                      {t("blocking")}
                    </Pill>
                  ) : null}
                </p>
                {check.passed || check.detail === "" ? null : (
                  <p className="text-xs text-muted-foreground">{check.detail}</p>
                )}
                {check.items.length === 0 ? null : (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {check.items.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="font-mono text-xs tabular-nums underline underline-offset-2"
                        onClick={() => onOpenItem(id)}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function OpenItemsPanel({ projectId, onOpenItem }: { projectId: string; onOpenItem: (id: string) => void }) {
  const rpc = useBaRpc();
  const query = useQuery(`open:${projectId}`, projectId, () =>
    rpc.call("items_list", { projectId, types: ["question", "conflict", "assumption"], status: ["open"] }),
  );
  const items = query.data?.items ?? [];
  return (
    <Panel title={t("openItems")} count={query.data === null ? undefined : items.length}>
      {query.error !== null ? <ErrorLine error={query.error} onRetry={query.refetch} /> : null}
      {query.data === null ? (
        query.error === null ? <Loading /> : null
      ) : items.length === 0 ? (
        <EmptyState title={t("noOpenItems")} />
      ) : (
        <ul className="flex max-h-80 flex-col divide-y divide-border/60 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full min-w-0 items-center gap-2 py-2 text-left text-sm"
                onClick={() => onOpenItem(item.id)}
              >
                <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{item.id}</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{typeLabel(item.type)}</span>
                <StatusPill status={item.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ChangeStageDialog({
  open,
  onOpenChange,
  projectId,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  current: StageId;
}) {
  const rpc = useBaRpc();
  const index = (PATH_STAGES as readonly string[]).indexOf(current);
  const next: StageId = index >= 0 && index < PATH_STAGES.length - 1 ? (PATH_STAGES[index + 1] as StageId) : current;
  const [target, setTarget] = useState<StageId>(next);
  const [acceptRisk, setAcceptRisk] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The gate that matters is the one of the stage we leave.
  const gate = useQuery(`gate:${projectId}:${current}:${open}`, projectId, () =>
    open ? rpc.call("gate_get", { projectId, stage: current }) : Promise.resolve(null),
  );
  const notReady = gate.data !== null && !gate.data.ready;
  const canMove = target !== current && !pending && (!notReady || acceptRisk.trim() !== "");

  const move = async () => {
    setPending(true);
    setError(null);
    try {
      await rpc.call("stage_set", {
        projectId,
        stage: target,
        ...(acceptRisk.trim() === "" ? {} : { acceptRisk: acceptRisk.trim() }),
      });
      setAcceptRisk("");
      onOpenChange(false);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("moveToNextStage")}</DialogTitle>
            <DialogDescription>
              {t("currentStage")}: {stageLabel(current)}
            </DialogDescription>
          </DialogHeader>
          <Field label={t("targetStage")} htmlFor="bo-target-stage">
            <NativeSelect
              id="bo-target-stage"
              value={target}
              onChange={(event) => setTarget(event.target.value as StageId)}
            >
              {STAGE_IDS.map((id) => (
                <option key={id} value={id}>
                  {stageLabel(id)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {gate.data === null ? (
            gate.error === null ? <Loading /> : <ErrorLine error={gate.error} onRetry={gate.refetch} />
          ) : notReady ? (
            <Field label={t("acceptRisk")} hint={t("acceptRiskHint")} htmlFor="bo-accept-risk">
              <TextArea
                id="bo-accept-risk"
                value={acceptRisk}
                onChange={(event) => setAcceptRisk(event.target.value)}
                placeholder={t("acceptRiskPlaceholder")}
                maxLength={2000}
              />
            </Field>
          ) : (
            <Pill tone="success" className="self-start">
              {t("gateReady")}
            </Pill>
          )}
          {error !== null ? <ErrorLine error={error} /> : null}
          <DialogFooter>
            <Button variant="outline" className="bo-raised" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button className="bo-accent" disabled={!canMove} onClick={() => void move()}>
              {t("move")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

