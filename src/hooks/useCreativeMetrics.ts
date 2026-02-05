"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CreativeMetrics } from "@/lib/types";

// Client-side cache to prevent re-fetching when panel reopens
const metricsCache = new Map<string, CreativeMetrics>();

interface UseCreativeMetricsResult {
  metrics: CreativeMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCreativeMetrics(
  creativeName: string,
  enabled: boolean = true
): UseCreativeMetricsResult {
  const [metrics, setMetrics] = useState<CreativeMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchMetrics = useCallback(
    async (forceRefresh = false) => {
      // Check client cache first (unless forcing refresh)
      if (!forceRefresh && metricsCache.has(creativeName)) {
        setMetrics(metricsCache.get(creativeName)!);
        return;
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const url = forceRefresh
          ? `/api/creatives/metrics?name=${encodeURIComponent(creativeName)}&refresh=true`
          : `/api/creatives/metrics?name=${encodeURIComponent(creativeName)}`;

        const response = await fetch(url, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch metrics");
        }

        const data: CreativeMetrics = await response.json();
        metricsCache.set(creativeName, data);
        setMetrics(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Ignore aborted requests
        }
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [creativeName]
  );

  const refresh = useCallback(() => {
    metricsCache.delete(creativeName);
    fetchMetrics(true);
  }, [creativeName, fetchMetrics]);

  useEffect(() => {
    if (enabled) {
      fetchMetrics();
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [enabled, fetchMetrics]);

  return { metrics, loading, error, refresh };
}
