import { useCallback, useState } from "react";
import { experimental_saveFile } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { errorText, useBaRpc } from "./data";
import { bundleExport, exportFileName } from "./helpers";
import { t } from "./i18n";

/** Download the whole project as one Markdown bundle. */
export function useExport(projectId: string, projectName: string) {
  const rpc = useBaRpc();
  const [pending, setPending] = useState(false);
  const run = useCallback(async () => {
    setPending(true);
    try {
      const { files } = await rpc.call("export_markdown", { projectId });
      const blob = new Blob([bundleExport(projectName, files)], { type: "text/markdown;charset=utf-8" });
      await experimental_saveFile({ fileName: exportFileName(projectId), blob });
    } catch (cause) {
      toast.error(`${t("exportFailed")} ${errorText(cause)}`);
    } finally {
      setPending(false);
    }
  }, [rpc, projectId, projectName]);
  return { run, pending };
}
