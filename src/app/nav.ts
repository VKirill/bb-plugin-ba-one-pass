import { useCallback } from "react";
import { useBbNavigate } from "@get-bb/plugin-sdk/app";
import { PANEL_PATH, routePath, type Route } from "./helpers";

/** Navigate inside the BA One Pass panel. */
export function useGo() {
  const navigate = useBbNavigate();
  return useCallback(
    (route: Route, options?: { replace?: boolean }) =>
      navigate.toPluginPanel(PANEL_PATH, {
        subPath: routePath(route),
        ...(options?.replace === true ? { replace: true } : {}),
      }),
    [navigate],
  );
}
