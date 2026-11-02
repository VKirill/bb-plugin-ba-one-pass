import { useMemo, useRef, useState, type MouseEvent } from "react";
import { Markdown } from "@get-bb/plugin-sdk/app";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { errorText, useBaRpc, useQuery } from "../data";
import { extractToc, ITEM_LINK_PREFIX, linkifyItemIds } from "../helpers";
import { formatDate, t } from "../i18n";
import { ItemDialog } from "../ItemDialog";
import { useGo } from "../nav";
import { DocStatusPill, ErrorLine, Loading, NativeSelect, stageLabel, Strip } from "../ui";

export function DocumentPage({ projectId, documentId }: { projectId: string; documentId: string }) {
  const rpc = useBaRpc();
  const go = useGo();
  const [version, setVersion] = useState<number | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const document = useQuery(`doc:${projectId}:${documentId}:${version ?? "latest"}`, projectId, () =>
    rpc.call("document_get", { projectId, id: documentId, ...(version === null ? {} : { version }) }),
  );
  const versions = useQuery(`doc-versions:${projectId}:${documentId}`, projectId, () =>
    rpc.call("document_versions", { projectId, id: documentId }),
  );

  const content = document.data?.content ?? "";
  const rendered = useMemo(() => linkifyItemIds(content), [content]);
  const toc = useMemo(() => extractToc(content), [content]);
  const isLatest = version === null;
  const versionList = useMemo(
    () => [...(versions.data?.versions ?? [])].sort((a, b) => b.version - a.version),
    [versions.data],
  );

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    const href = anchor?.getAttribute("href") ?? "";
    const at = href.indexOf(ITEM_LINK_PREFIX);
    if (at < 0) return;
    event.preventDefault();
    event.stopPropagation();
    setOpenItem(decodeURIComponent(href.slice(at + ITEM_LINK_PREFIX.length)));
  };

  const scrollToHeading = (index: number) => {
    const headings = contentRef.current?.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headings?.[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const approve = async () => {
    setApproving(true);
    setApproveError(null);
    try {
      await rpc.call("document_update", { projectId, id: documentId, status: "approved" });
    } catch (cause) {
      setApproveError(errorText(cause));
    } finally {
      setApproving(false);
    }
  };

  const data = document.data;
  return (
    <div className="flex flex-col gap-4">
      <Strip
        title={data?.title ?? t("document")}
        meta={
          data === null ? undefined : (
            <>
              <DocStatusPill status={data.status} />
              <span className="font-mono tabular-nums">v{data.version}</span>
              {data.stage === null ? null : <span>{stageLabel(data.stage)}</span>}
              <span>{t("updated", { date: formatDate(data.updatedAt) })}</span>
            </>
          )
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => go({ kind: "overview", projectId })}>
              <Icon name="ChevronLeft" className="size-4" aria-hidden />
              {t("overview")}
            </Button>
            {versionList.length > 1 ? (
              <NativeSelect
                aria-label={t("versions")}
                className="w-auto"
                value={version === null ? "" : String(version)}
                onChange={(event) => setVersion(event.target.value === "" ? null : Number(event.target.value))}
              >
                <option value="">{t("version", { n: versionList[0]?.version ?? "" })}</option>
                {versionList.slice(1).map((entry) => (
                  <option key={entry.version} value={entry.version}>
                    {t("version", { n: entry.version })} · {formatDate(entry.createdAt)}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            {data !== null && isLatest && data.status !== "approved" ? (
              <Button className="bo-accent" disabled={approving} onClick={() => void approve()}>
                <Icon name="Check" className="size-4" aria-hidden />
                {approving ? t("approving") : t("approve")}
              </Button>
            ) : null}
          </>
        }
      />
      {approveError !== null ? <ErrorLine error={approveError} /> : null}
      {document.error !== null ? <ErrorLine error={document.error} onRetry={document.refetch} /> : null}
      {data === null ? (
        document.error === null ? <Loading /> : null
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <article className="bo-card min-w-0 p-4 md:p-6">
            <div ref={contentRef} onClickCapture={onClickCapture}>
              <Markdown content={rendered} />
            </div>
          </article>
          {toc.length < 2 ? null : (
            <nav aria-label={t("contents")} className="order-first lg:order-none">
              <div className="bo-panel lg:sticky lg:top-3">
                <div className="bo-panel-head">
                  <h2 className="text-sm font-medium">{t("contents")}</h2>
                </div>
                <ul className="bo-panel-body flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto">
                  {toc.map((entry) => (
                    <li key={entry.index}>
                      <button
                        type="button"
                        className="bo-nav-item block w-full truncate px-2 py-1 text-left text-xs"
                        style={{ paddingLeft: `${(entry.level - 1) * 10 + 8}px` }}
                        onClick={() => scrollToHeading(entry.index)}
                      >
                        {entry.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          )}
        </div>
      )}
      <ItemDialog projectId={projectId} itemId={openItem} onClose={() => setOpenItem(null)} onOpenItem={setOpenItem} />
    </div>
  );
}
