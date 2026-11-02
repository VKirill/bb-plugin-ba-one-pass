import { useState } from "react";
import { ThreadChat } from "@get-bb/plugin-sdk/app";
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
import { errorText, useBaRpc, useProject } from "../data";
import { t } from "../i18n";
import { useGo } from "../nav";
import { ErrorLine, Field, Pill, stageLabel, TextArea } from "../ui";

/** One BA session: BB's own chat for the thread, under a slim header. */
export function SessionPage({ projectId, threadId }: { projectId: string; threadId: string }) {
  const project = useProject(projectId);
  const go = useGo();
  const [closing, setClosing] = useState(false);
  const session = project.data?.sessions.find((candidate) => candidate.threadId === threadId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1 text-muted-foreground"
          onClick={() => go({ kind: "overview", projectId })}
        >
          <Icon name="ChevronLeft" className="size-4" aria-hidden />
          <span className="max-w-40 truncate">{project.data?.project.name ?? t("overview")}</span>
        </Button>
        {session === null ? null : (
          <>
            <Pill tone="info">{stageLabel(session.stage)}</Pill>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{session.title}</span>
            <Pill tone={session.status === "active" ? "info" : "muted"}>
              {session.status === "active" ? t("sessionActive") : t("sessionClosed")}
            </Pill>
            {session.status === "active" ? (
              <Button variant="outline" size="sm" className="bo-raised" onClick={() => setClosing(true)}>
                {t("closeSession")}
              </Button>
            ) : null}
          </>
        )}
        {project.data !== null && session === null ? (
          <span className="text-xs text-muted-foreground">{t("sessionNotFound")}</span>
        ) : null}
      </div>
      {project.error !== null ? (
        <div className="px-4 py-2">
          <ErrorLine error={project.error} onRetry={project.refetch} />
        </div>
      ) : null}
      {session?.status === "closed" && session.summary !== null ? (
        <p className="shrink-0 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">{session.summary}</p>
      ) : null}
      <div className="min-h-0 flex-1">
        <ThreadChat threadId={threadId} variant="full" layout="contained" className="h-full" />
      </div>
      <CloseSessionDialog threadId={threadId} open={closing} onOpenChange={setClosing} />
    </div>
  );
}

function CloseSessionDialog({
  threadId,
  open,
  onOpenChange,
}: {
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rpc = useBaRpc();
  const [summary, setSummary] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = async () => {
    setPending(true);
    setError(null);
    try {
      await rpc.call("session_close", {
        threadId,
        ...(summary.trim() === "" ? {} : { summary: summary.trim() }),
      });
      setSummary("");
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
            <DialogTitle>{t("closeSession")}</DialogTitle>
            <DialogDescription>{t("closeSessionHint")}</DialogDescription>
          </DialogHeader>
          <Field label={t("closeSessionSummary")} htmlFor="bo-close-summary">
            <TextArea
              id="bo-close-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={8000}
            />
          </Field>
          {error !== null ? <ErrorLine error={error} /> : null}
          <DialogFooter>
            <Button variant="outline" className="bo-raised" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button className="bo-accent" disabled={pending} onClick={() => void close()}>
              {pending ? t("closing") : t("closeSession")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
