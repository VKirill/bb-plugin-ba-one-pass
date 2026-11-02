// Details of one register record: body, attributes, sources with quotes,
// links in/out and history. Opened from registers, documents and overview.
import { Markdown } from "@get-bb/plugin-sdk/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBaRpc, useQuery } from "./data";
import { formatDate, t } from "./i18n";
import { ErrorLine, Loading, Pill, priorityLabel, StatusPill, typeLabel } from "./ui";

export function ItemDialog({
  projectId,
  itemId,
  onClose,
  onOpenItem,
}: {
  projectId: string;
  itemId: string | null;
  onClose: () => void;
  onOpenItem: (id: string) => void;
}) {
  return (
    <Dialog open={itemId !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {itemId === null ? null : <ItemBody projectId={projectId} itemId={itemId} onOpenItem={onOpenItem} />}
      </DialogContent>
    </Dialog>
  );
}

function ItemBody({
  projectId,
  itemId,
  onOpenItem,
}: {
  projectId: string;
  itemId: string;
  onOpenItem: (id: string) => void;
}) {
  const rpc = useBaRpc();
  const query = useQuery(`item:${projectId}:${itemId}`, projectId, () =>
    rpc.call("item_get", { projectId, id: itemId }),
  );
  const data = query.data;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm tabular-nums text-muted-foreground">{itemId}</span>
          <span className="min-w-0 break-words">{data?.item.title ?? t("item")}</span>
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          {data === null ? null : (
            <>
              <span>{typeLabel(data.item.type)}</span>
              <StatusPill status={data.item.status} />
              {data.item.priority === null ? null : <Pill tone="neutral">{priorityLabel(data.item.priority)}</Pill>}
              {data.item.owner === null ? null : (
                <span>
                  {t("owner")}: {data.item.owner}
                </span>
              )}
              <span>{t("updated", { date: formatDate(data.item.updatedAt) })}</span>
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      {query.error !== null ? <ErrorLine error={query.error} onRetry={query.refetch} /> : null}
      {data === null ? (
        query.error === null ? <Loading /> : null
      ) : (
        <>
          {data.item.body.trim() === "" ? null : (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">{t("body")}</h3>
              <Markdown content={data.item.body} className="text-sm" />
            </section>
          )}
          {Object.keys(data.item.attrs).length === 0 ? null : (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">{t("attributes")}</h3>
              <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                {Object.entries(data.item.attrs).map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="truncate font-mono text-xs text-muted-foreground">{key}</dt>
                    <dd className="min-w-0 break-words">
                      {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                        ? String(value)
                        : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-muted-foreground">{t("sources")}</h3>
            {data.item.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noSources")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.item.sources.map((source, index) => (
                  <li key={index} className="bo-raised rounded-lg px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Pill tone="muted">{source.kind}</Pill>
                      <span className="min-w-0 break-all font-mono">{source.ref}</span>
                    </div>
                    {source.quote === undefined ? null : (
                      <blockquote className="mt-1.5 border-l-2 border-border pl-2 italic">{source.quote}</blockquote>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <LinkList title={t("linksOut")} links={data.outgoing.map((link) => ({ ...link, other: link.to }))} onOpenItem={onOpenItem} />
          <LinkList title={t("linksIn")} links={data.incoming.map((link) => ({ ...link, other: link.from }))} onOpenItem={onOpenItem} />
          {data.history.length === 0 ? null : (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">{t("history")}</h3>
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {data.history.map((entry) => (
                  <li key={entry.version}>
                    {t("historyEntry", { n: entry.version, date: formatDate(entry.changedAt) })}
                    {entry.note === null ? "" : ` — ${entry.note}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function LinkList({
  title,
  links,
  onOpenItem,
}: {
  title: string;
  links: Array<{ other: string; relation: string; title: string; note: string | null }>;
  onOpenItem: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noLinks")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {links.map((link) => (
            <li key={`${link.relation}:${link.other}`} className="flex min-w-0 items-center gap-2 text-sm">
              <Pill tone="muted" className="font-mono">
                {link.relation}
              </Pill>
              <button
                type="button"
                className="shrink-0 font-mono text-xs tabular-nums underline underline-offset-2"
                onClick={() => onOpenItem(link.other)}
              >
                {link.other}
              </button>
              <span className="min-w-0 truncate">{link.title}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
