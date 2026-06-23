"use client";

import { useState, useEffect, useRef } from "react";

// Client cache so reopening a panel doesn't re-request the insight.
const insightCache = new Map<string, { insight: string | null; enabled: boolean }>();

interface UseCreativeInsightResult {
  insight: string | null;
  enabled: boolean;
  loading: boolean;
  error: string | null;
}

export function useCreativeInsight(
  convexAdId: string | undefined,
  enabled: boolean = true
): UseCreativeInsightResult {
  const [insight, setInsight] = useState<string | null>(null);
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !convexAdId) return;

    const cached = insightCache.get(convexAdId);
    if (cached) {
      setInsight(cached.insight);
      setServiceEnabled(cached.enabled);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/creatives/insights?id=${encodeURIComponent(convexAdId)}`, {
      signal: abortRef.current.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load insight");
        return r.json();
      })
      .then((data: { insight: string | null; enabled?: boolean }) => {
        const value = { insight: data.insight, enabled: data.enabled !== false };
        insightCache.set(convexAdId, value);
        setInsight(value.insight);
        setServiceEnabled(value.enabled);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => setLoading(false));

    return () => abortRef.current?.abort();
  }, [convexAdId, enabled]);

  return { insight, enabled: serviceEnabled, loading, error };
}
