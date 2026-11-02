import { useMemo, useState } from "react";
import type { ItemType } from "../../shared/model";
import { useBaRpc, useQuery } from "../data";
import { t } from "../i18n";
import { ItemDialog } from "../ItemDialog";
import { EmptyState, ErrorLine, Loading, Pill, priorityLabel, Segments, Strip } from "../ui";
import { cn } from "@/lib/utils";

type Preset = "req_ac" | "goal_req" | "req_risk";

const PRESETS: Record<Preset, { from: ItemType[]; to: ItemType[] }> = {
  req_ac: { from: ["requirement"], to: ["criterion"] },
  goal_req: { from: ["goal"], to: ["requirement"] },
  req_risk: { from: ["requirement"], to: ["risk"] },
};

export function TracePage({ projectId }: { projectId: string }) {
  const rpc = useBaRpc();
  const [preset, setPreset] = useState<Preset>("req_ac");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const matrix = useQuery(`trace:${projectId}:${preset}`, projectId, () =>
    rpc.call("trace_matrix", { projectId, ...PRESETS[preset] }),
  );

  const cellMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cell of matrix.data?.cells ?? []) map.set(`${cell.row}\u0000${cell.column}`, cell.relation);
    return map;
  }, [matrix.data]);
  const coveredRows = useMemo(() => new Set((matrix.data?.cells ?? []).map((cell) => cell.row)), [matrix.data]);

  const data = matrix.data;
  return (
    <div className="flex flex-col gap-4">
      <Strip
        title={t("traceability")}
        actions={
          <Segments
            label={t("tracePreset")}
            value={preset}
            onChange={setPreset}
            options={[
              { value: "req_ac", label: t("trace_req_ac") },
              { value: "goal_req", label: t("trace_goal_req") },
              { value: "req_risk", label: t("trace_req_risk") },
            ]}
          />
        }
      />
      {matrix.error !== null ? <ErrorLine error={matrix.error} onRetry={matrix.refetch} /> : null}
      <div className="bo-card overflow-hidden">
        {data === null ? (
          matrix.error === null ? (
            <div className="px-4">
              <Loading />
            </div>
          ) : null
        ) : data.rows.length === 0 ? (
          <EmptyState title={t("traceEmpty")} />
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border/60">
                  <th className="sticky left-0 z-20 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                    {t("id")}
                  </th>
                  {data.columns.map((column) => (
                    <th key={column.id} className="px-1.5 py-2 font-medium" title={column.title}>
                      <button
                        type="button"
                        className="font-mono tabular-nums underline-offset-2 hover:underline"
                        onClick={() => setOpenItem(column.id)}
                      >
                        {column.id}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.rows.map((row) => {
                  const uncovered = row.priority === "must" && !coveredRows.has(row.id);
                  return (
                    <tr key={row.id} className={cn(uncovered && "bg-warning/10")}>
                      <th className="sticky left-0 z-10 max-w-64 bg-card px-3 py-1.5 text-left font-normal">
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            className="shrink-0 font-mono tabular-nums underline-offset-2 hover:underline"
                            onClick={() => setOpenItem(row.id)}
                          >
                            {row.id}
                          </button>
                          <span className="min-w-0 truncate text-muted-foreground" title={row.title}>
                            {row.title}
                          </span>
                          {row.priority === null ? null : (
                            <Pill tone={uncovered ? "warning" : "muted"} className="shrink-0">
                              {uncovered ? t("mustUncovered") : priorityLabel(row.priority)}
                            </Pill>
                          )}
                        </div>
                      </th>
                      {data.columns.map((column) => {
                        const relation = cellMap.get(`${row.id}\u0000${column.id}`);
                        return (
                          <td
                            key={column.id}
                            className="px-1.5 py-1.5 text-center"
                            title={relation === undefined ? undefined : `${row.id} ${relation} ${column.id}`}
                          >
                            {relation === undefined ? (
                              <span className="text-muted-foreground/40" aria-hidden>
                                ·
                              </span>
                            ) : (
                              <span className="bo-text-success" aria-label={relation}>
                                ●
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ItemDialog projectId={projectId} itemId={openItem} onClose={() => setOpenItem(null)} onOpenItem={setOpenItem} />
    </div>
  );
}
