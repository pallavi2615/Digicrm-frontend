/**
 * React Query hook that fetches and caches the Real Estate CRM
 * configuration enums. Config is cached for the session, so dropdown
 * data is only fetched once.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ReConfig } from "@/lib/re-data";

export function useReConfig() {
  return useQuery({
    queryKey: ["re-config"],
    queryFn: () => apiFetch<ReConfig>("/api/v1/realestate/config"),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}