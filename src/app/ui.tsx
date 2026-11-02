// Small shared building blocks in the Pokecut look (classes with the bo- prefix).
import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { t, tMaybe } from "./i18n";
import type { StageId } from "../shared/model";

export type PillTone = "success" | "info" | "warning" | "danger" | "neutral" | "muted";

export function Pill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return <span className={cn("bo-pill", `bo-pill-${tone}`, className)}>{children}</span>;
}

const STATUS_TONE: Record<string, PillTone> = {
  confirmed: "success",
  verified: "success",
  validated: "success",
  approved: "success",
  resolved: "success",
  answered: "success",
  processed: "success",
  mitigated: "success",
  addressed: "success",
  implemented: "success",
  recommended: "success",
  active: "neutral",
  open: "warning",
  draft: "muted",
  deferred: "warning",
  assessed: "info",
  proposed: "info",
  received: "info",
  review: "info",
  accepted: "info",
  recorded: "neutral",
  rejected: "danger",
  invalidated: "danger",
  wont_fix: "muted",
  inactive: "muted",
  deprecated: "muted",
  superseded: "muted",
  out_of_scope: "muted",
  lifted: "muted",
  closed: "muted",
};

export function statusLabel(status: string): string {
  return tMaybe(`st_${status}`, status);
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONE[status] ?? "neutral"}>{statusLabel(status)}</Pill>;
}

export function DocStatusPill({ status }: { status: string }) {
  const tone: PillTone = status === "approved" ? "success" : status === "review" ? "info" : "muted";
  return <Pill tone={tone}>{tMaybe(`docStatus_${status}`, status)}</Pill>;
}

export function stageLabel(stage: StageId | string): string {
  return tMaybe(`stage_${stage}`, stage);
}

export function priorityLabel(priority: string | null): string {
  return priority === null ? "—" : tMaybe(`priority_${priority}`, priority);
}

export function typeLabel(type: string): string {
  return tMaybe(`type_${type}`, type);
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint === undefined ? null : <p className="max-w-md text-xs text-muted-foreground">{hint}</p>}
      {action ?? null}
    </div>
  );
}

export function Loading() {
  return (
    <div role="status" className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
      <Icon name="Spinner" className="size-4 animate-spin" aria-hidden />
      {t("loading")}
    </div>
  );
}

export function ErrorLine({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
      <Icon name="AlertCircle" className="size-4" aria-hidden />
      <span className="min-w-0 break-words">
        {t("errorPrefix")}: {error}
      </span>
      {onRetry === undefined ? null : (
        <button type="button" className="underline underline-offset-2" onClick={onRetry}>
          {t("retry")}
        </button>
      )}
    </div>
  );
}

/** A gray well with a header line and a white body card. */
export function Panel({
  title,
  count,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bo-panel", className)}>
      <div className="bo-panel-head">
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {title}
          {count === undefined ? null : (
            <span className="ml-1.5 font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
          )}
        </h2>
        {actions ?? null}
      </div>
      <div className="bo-panel-body">{children}</div>
    </section>
  );
}

/** The page header strip: one H1, metadata, page actions. */
export function Strip({ title, meta, actions }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="bo-strip flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-medium">{title}</h1>
        {meta === undefined ? null : (
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{meta}</div>
        )}
      </div>
      {actions === undefined ? null : <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint === undefined ? null : <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const fieldClass =
  "bo-raised w-full min-w-0 rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export function NativeSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, "h-9 py-0", className)} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "min-h-20 resize-y", className)} {...props} />;
}

/** Segmented control for 2–5 slices of one set. */
export function Segments<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="bo-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="bo-seg-item px-2.5 py-1 text-xs"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
