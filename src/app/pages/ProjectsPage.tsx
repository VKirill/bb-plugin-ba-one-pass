import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PATH_STAGES, PROJECT_ID_PATTERN } from "../../shared/model";
import type { ProjectListEntry } from "../../shared/contract";
import { errorText, useBaRpc, useProjects, useQuery } from "../data";
import { t } from "../i18n";
import { useGo } from "../nav";
import { EmptyState, ErrorLine, Field, Loading, NativeSelect, Pill, Segments, stageLabel, Strip, TextArea } from "../ui";

export function ProjectsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const projects = useProjects(showArchived);
  const go = useGo();

  return (
    <div className="flex flex-col gap-4">
      <Strip
        title={t("projects")}
        actions={
          <>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              {t("showArchived")}
            </label>
            <Button className="bo-accent" onClick={() => setCreating(true)}>
              <Icon name="Plus" className="size-4" aria-hidden />
              {t("newProject")}
            </Button>
          </>
        }
      />
      {projects.error !== null ? <ErrorLine error={projects.error} onRetry={projects.refetch} /> : null}
      {projects.data === null ? (
        projects.error === null ? <Loading /> : null
      ) : projects.data.projects.length === 0 ? (
        <div className="bo-card">
          <EmptyState title={t("noProjectsTitle")} hint={t("noProjectsHint")} />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data.projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} onOpen={() => go({ kind: "overview", projectId: project.id })} />
            </li>
          ))}
        </ul>
      )}
      <NewProjectDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(projectId) => {
          setCreating(false);
          go({ kind: "overview", projectId });
        }}
      />
    </div>
  );
}

export function StageProgress({ stage }: { stage: string }) {
  const index = (PATH_STAGES as readonly string[]).indexOf(stage);
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1" aria-hidden>
        {PATH_STAGES.map((pathStage, position) => (
          <span
            key={pathStage}
            className={
              index >= 0 && position <= index
                ? "h-1.5 flex-1 rounded-full bg-primary"
                : "h-1.5 flex-1 rounded-full bg-muted"
            }
          />
        ))}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{stageLabel(stage)}</span>
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: ProjectListEntry; onOpen: () => void }) {
  const { counts } = project;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bo-card flex h-full w-full flex-col gap-3 p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="bo-tile size-8">
          <Icon name="FileText" className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="truncate text-xs text-muted-foreground">{project.product || project.id}</p>
        </div>
        {project.sensitive ? (
          <Pill tone="warning">
            <Icon name="Lock" className="size-3" aria-hidden />
            {t("sensitive")}
          </Pill>
        ) : null}
        {project.archived ? <Pill tone="muted">{t("archived")}</Pill> : null}
      </div>
      <StageProgress stage={project.stage} />
      <div className="flex flex-wrap gap-1.5">
        {counts.openQuestions > 0 ? <Pill tone="warning">{t("openQuestions", { n: counts.openQuestions })}</Pill> : null}
        {counts.openConflicts > 0 ? <Pill tone="danger">{t("openConflicts", { n: counts.openConflicts })}</Pill> : null}
        <Pill tone="muted">{t("documentsCount", { n: counts.documents })}</Pill>
        <Pill tone="muted">
          {t("sessionsCount", { n: counts.sessions })}
          {counts.activeSessions > 0 ? ` · ${t("activeSessionsCount", { n: counts.activeSessions })}` : ""}
        </Pill>
      </div>
    </button>
  );
}

function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (projectId: string) => void;
}) {
  const rpc = useBaRpc();
  const bbProjects = useQuery(`bb-projects:${open}`, null, () =>
    open ? rpc.call("bb_projects_list", null) : Promise.resolve({ projects: [] }),
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [bbProjectId, setBbProjectId] = useState("");
  const [goal, setGoal] = useState("");
  const [product, setProduct] = useState("");
  const [language, setLanguage] = useState("ru");
  const [sensitive, setSensitive] = useState(false);
  const [startStage, setStartStage] = useState<"plan" | "one-pass">("plan");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugValid = slug === "" || PROJECT_ID_PATTERN.test(slug);
  const canSubmit = name.trim() !== "" && bbProjectId !== "" && slugValid && !pending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const project = await rpc.call("project_create", {
        name: name.trim(),
        ...(slug === "" ? {} : { id: slug }),
        goal: goal.trim(),
        product: product.trim(),
        bbProjectId,
        language,
        sensitive,
        startStage,
      });
      setName("");
      setSlug("");
      setGoal("");
      setProduct("");
      onCreated(project.id);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("newProject")}</DialogTitle>
            <DialogDescription>{t("noProjectsHint")}</DialogDescription>
          </DialogHeader>
          <Field label={t("projectName")} htmlFor="bo-new-name">
            <Input
              id="bo-new-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("projectNamePlaceholder")}
              maxLength={120}
              autoFocus
            />
          </Field>
          <Field label={t("bbProject")} hint={t("bbProjectHint")} htmlFor="bo-new-bb">
            <NativeSelect id="bo-new-bb" value={bbProjectId} onChange={(event) => setBbProjectId(event.target.value)}>
              <option value="">{bbProjects.loading ? t("loading") : t("bbProjectChoose")}</option>
              {(bbProjects.data?.projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {bbProjects.error !== null ? <ErrorLine error={bbProjects.error} onRetry={bbProjects.refetch} /> : null}
          <Field label={t("projectGoal")} htmlFor="bo-new-goal">
            <TextArea
              id="bo-new-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder={t("projectGoalPlaceholder")}
              maxLength={2000}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("projectProduct")} htmlFor="bo-new-product">
              <Input
                id="bo-new-product"
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                placeholder={t("projectProductPlaceholder")}
                maxLength={300}
              />
            </Field>
            <Field label={t("projectLanguage")} htmlFor="bo-new-lang">
              <NativeSelect id="bo-new-lang" value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="ru">{t("languageRu")}</option>
                <option value="en">{t("languageEn")}</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label={t("projectSlug")} hint={t("projectSlugHint")} htmlFor="bo-new-slug">
            <Input
              id="bo-new-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              aria-invalid={!slugValid}
              maxLength={64}
              className="font-mono"
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("startMode")}</span>
            <Segments
              label={t("startMode")}
              value={startStage}
              onChange={setStartStage}
              options={[
                { value: "plan", label: t("startModeFull") },
                { value: "one-pass", label: t("startModeOnePass") },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {startStage === "plan" ? t("startModeFullHint") : t("startModeOnePassHint")}
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={sensitive}
              onChange={(event) => setSensitive(event.target.checked)}
            />
            <span>
              <span className="font-medium">{t("sensitive")}</span>
              <span className="block text-xs text-muted-foreground">{t("sensitiveHint")}</span>
            </span>
          </label>
          {error !== null ? <ErrorLine error={error} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="bo-raised" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" className="bo-accent" disabled={!canSubmit}>
              {pending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
