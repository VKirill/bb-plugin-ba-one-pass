// Data hooks over the plugin RPC. Every query refetches on PROJECT_CHANGED
// (for its project, or any project when it is project-independent).
import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { RpcContract } from "../shared/contract";
import { PROJECT_CHANGED_CHANNEL } from "./helpers";

export function useBaRpc() {
  return useRpc<RpcContract>();
}

export interface QueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

export function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Run `load` when `key` changes and whenever the project (or, with
 * projectId null, any project) reports a change. Stale responses are dropped.
 */
export function useQuery<T>(key: string, projectId: string | null, load: () => Promise<T>): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const generation = useRef(0);

  const refetch = useCallback(() => {
    const current = ++generation.current;
    setLoading(true);
    loadRef.current().then(
      (value) => {
        if (current !== generation.current) return;
        setData(value);
        setError(null);
        setLoading(false);
      },
      (cause: unknown) => {
        if (current !== generation.current) return;
        setError(errorText(cause));
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    setData(null);
    refetch();
  }, [key, refetch]);

  useRealtime(PROJECT_CHANGED_CHANNEL, (payload) => {
    const changed =
      typeof payload === "object" && payload !== null && "projectId" in payload
        ? (payload as { projectId: unknown }).projectId
        : null;
    if (projectId === null || changed === null || changed === projectId) refetch();
  });

  return { data, error, loading, refetch };
}

export function useProjects(includeArchived: boolean) {
  const rpc = useBaRpc();
  return useQuery(`projects:${includeArchived}`, null, () => rpc.call("projects_list", { includeArchived }));
}

export function useProject(projectId: string) {
  const rpc = useBaRpc();
  return useQuery(`project:${projectId}`, projectId, () => rpc.call("project_get", { projectId }));
}
