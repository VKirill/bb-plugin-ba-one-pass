import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ITEM_STATUSES, type ItemType } from "../../shared/model";
import { useBaRpc, useQuery } from "../data";
import { formatDate, t } from "../i18n";
import { ItemDialog } from "../ItemDialog";
import { EmptyState, ErrorLine, Loading, NativeSelect, Pill, priorityLabel, StatusPill, Strip, statusLabel, typeLabel } from "../ui";

export function RegisterPage({ projectId, type }: { projectId: string; type: ItemType }) {
  const rpc = useBaRpc();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<string | null>(null);

  // Debounce the search box so typing does not fire a request per key.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setStatus("");
    setSearch("");
  }, [type]);

  const items = useQuery(`items:${projectId}:${type}:${status}:${query}`, projectId, () =>
    rpc.call("items_list", {
      projectId,
      types: [type],
      ...(status === "" ? {} : { status: [status] }),
      ...(query === "" ? {} : { query }),
    }),
  );
  const list = items.data?.items ?? [];
  const showPriority = list.some((item) => item.priority !== null);

  return (
    <div className="flex flex-col gap-4">
      <Strip
        title={typeLabel(type)}
        meta={<span>{t("register")}</span>}
        actions={
          <>
            <div className="relative">
              <Icon
                name="Search"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                className="h-9 w-44 pl-8"
                maxLength={200}
              />
            </div>
            <NativeSelect
              aria-label={t("statusFilter")}
              className="w-auto"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">
                {t("statusFilter")}: {t("all")}
              </option>
              {ITEM_STATUSES[type].map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />
      {items.error !== null ? <ErrorLine error={items.error} onRetry={items.refetch} /> : null}
      <div className="bo-card overflow-hidden">
        {items.data === null ? (
          items.error === null ? (
            <div className="px-4">
              <Loading />
            </div>
          ) : null
        ) : list.length === 0 ? (
          <EmptyState title={t("noItems")} hint={t("noItemsHint")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t("id")}</th>
                  <th className="px-2 py-2 font-medium">{t("title")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  {showPriority ? <th className="px-2 py-2 font-medium">{t("priority")}</th> : null}
                  <th className="px-4 py-2 text-right font-medium">{t("updatedAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {list.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setOpenItem(item.id)}
                  >
                    <td className="px-4 py-2.5 align-top">
                      <button
                        type="button"
                        className="font-mono text-xs tabular-nums underline-offset-2 hover:underline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenItem(item.id);
                        }}
                      >
                        {item.id}
                      </button>
                    </td>
                    <td className="max-w-0 px-2 py-2.5 align-top">
                      <p className="truncate">{item.title}</p>
                      {item.kind === null ? null : (
                        <p className="text-xs text-muted-foreground">{item.kind}</p>
                      )}
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      <StatusPill status={item.status} />
                    </td>
                    {showPriority ? (
                      <td className="px-2 py-2.5 align-top">
                        {item.priority === null ? null : <Pill tone="neutral">{priorityLabel(item.priority)}</Pill>}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-4 py-2.5 text-right align-top text-xs text-muted-foreground">
                      {formatDate(item.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ItemDialog projectId={projectId} itemId={openItem} onClose={() => setOpenItem(null)} onOpenItem={setOpenItem} />
    </div>
  );
}
