import { NextRequest, NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { CreativeMetrics, CampaignMetrics } from "@/lib/types";
import { findConvexAdIdByName } from "@/lib/adsLibrary";
import adsLibraryClient from "@/lib/convexClient";
import { anyApi } from "convex/server";

const METRICS_CACHE_PREFIX = "snapshot_metrics_";
const METRICS_TTL = 600; // 10 minutes; snapshots refresh hourly server-side

interface ConvexSnapshot {
  _id: string;
  ad_id: string;
  snapshot_date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  leads: number;
  cpl?: number;
  raw_actions?: string;
}

/**
 * Build a CreativeMetrics shape from a single performance_snapshot row.
 *
 * The legacy gallery grouped metrics by campaign objective (lead vs purchase).
 * Snapshots in convex are flat per-ad and currently only track leads, so we
 * emit a single "lead" CampaignMetrics entry. (When the cron starts capturing
 * purchase actions we can split this out.)
 */
function snapshotToMetrics(snap: ConvexSnapshot | null): CreativeMetrics {
  if (!snap) {
    return {
      lastUpdated: new Date().toISOString(),
      campaigns: [],
      totalSpent: 0,
    };
  }

  const campaign: CampaignMetrics = {
    campaignType: "lead",
    spent: snap.spend,
    results: snap.leads,
    costPerResult:
      snap.cpl ?? (snap.leads > 0 ? snap.spend / snap.leads : 0),
    impressions: snap.impressions,
    clicks: snap.clicks,
    cpm: snap.impressions > 0 ? (snap.spend / snap.impressions) * 1000 : 0,
    ctr: snap.ctr,
    matchedAds: 1,
  };

  return {
    lastUpdated: snap.snapshot_date,
    campaigns: [campaign],
    totalSpent: snap.spend,
  };
}

export async function GET(request: NextRequest) {
  const creativeName = request.nextUrl.searchParams.get("name");
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!creativeName) {
    return NextResponse.json(
      { error: "Missing creative name parameter" },
      { status: 400 }
    );
  }

  const cacheKey = `${METRICS_CACHE_PREFIX}${creativeName.toLowerCase().trim()}`;
  if (refresh) cache.delete(cacheKey);

  const cached = cache.get<CreativeMetrics>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const found = await findConvexAdIdByName(creativeName);
    if (!found) {
      const empty: CreativeMetrics = {
        lastUpdated: new Date().toISOString(),
        campaigns: [],
        totalSpent: 0,
      };
      cache.set(cacheKey, empty, METRICS_TTL);
      return NextResponse.json(empty);
    }

    // NOTE: snapshots:getLatestSnapshot is being added by a parallel subagent
    // (Phase 4 cron). If it doesn't exist yet at runtime, we catch and
    // return an empty metrics payload so the UI degrades gracefully.
    let snap: ConvexSnapshot | null = null;
    try {
      snap = (await adsLibraryClient.query(
        anyApi.snapshots.getLatestSnapshot,
        { ad_id: found.adId }
      )) as ConvexSnapshot | null;
    } catch (err) {
      console.warn(
        "[metrics] snapshots.getLatestSnapshot failed (cron not deployed yet?)",
        err
      );
    }

    const metrics = snapshotToMetrics(snap);
    cache.set(cacheKey, metrics, METRICS_TTL);
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Failed to fetch creative metrics from snapshots:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
