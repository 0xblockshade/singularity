import { createContext, useContext, type ReactNode } from "react";
import { getStatus } from "@/lib/api";
import { useAsyncData } from "@/hooks/useAsyncData";
import type { Status } from "@/lib/types";

interface StatusValue {
  status: Status | null;
  sample: boolean;
  loading: boolean;
}

const StatusContext = createContext<StatusValue>({
  status: null,
  sample: false,
  loading: true,
});

/** Fetched once at the app root so the header and Today page share one call. */
export function StatusProvider({ children }: { children: ReactNode }) {
  const { data, loading } = useAsyncData(() => getStatus(), []);
  const value: StatusValue = {
    status: data?.data ?? null,
    sample: data?.sample ?? false,
    loading,
  };
  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useStatus(): StatusValue {
  return useContext(StatusContext);
}
