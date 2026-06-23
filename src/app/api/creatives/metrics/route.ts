import { NextRequest, NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { CreativeMetrics, CampaignMetrics } from "@/lib/types";
import { findConvexAdIdByName } from "@/lib/adsLibrary";
import { getMetaIdByName } from "@/lib/metaIdMap";
import { fetchAdInsights, aggregateByObjective } from "@/lib/meta";
import adsLibraryClient from "@/lib/convexClient";
import { anyApi } from "convex/server";

const METRICS_CACHE_PREFIX = "snapshot_metrics_";
const METRICS_TTL = 600; // 10 minutes; snapshots refresh hourly server-side

/**
 * Fetch live performance straight from the Meta Graph API for a single ad id.
 * Returns null when Meta isn't configured, the ad has no insights, or the
 * call fails — callers then fall back to the Convex snapshot.
 */
async function fetchLiveMetaMetrics(
  metaAdId: string
): Promise<CreativeMetrics | null> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const insights = await fetchAdInsights(token, [metaAdId]);
    const campaigns = aggregateByObjective(insights);
    if (campaigns.length === 0) return null;
    const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);
    return {
      lastUpdated: new Date().toISOString(),
      campaigns,
      totalSpent,
    };
  } catch (err) {
    console.warn("[metrics] live Meta fetch failed:", err);
    return null;
  }
}

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

    // Resolve a Meta ad id: prefer the Convex row, else the upload-tracker
    // sheet (covers ~94% of ads that have no meta_ad_id in Convex).
    const metaAdId =
      found?.metaAdId || (await getMetaIdByName(creativeName)) || null;

    // Primary source: live Meta Graph performance for the resolved ad id.
    if (metaAdId) {
      const live = await fetchLiveMetaMetrics(metaAdId);
      if (live) {
        cache.set(cacheKey, live, METRICS_TTL);
        return NextResponse.json(live);
      }
    }

    // Fallback: the Convex performance snapshot (only exists for linked ads).
    if (!found) {
      const empty: CreativeMetrics = {
        lastUpdated: new Date().toISOString(),
        campaigns: [],
        totalSpent: 0,
      };
      cache.set(cacheKey, empty, METRICS_TTL);
      return NextResponse.json(empty);
    }

    let snap: ConvexSnapshot | null = null;
    try {
      snap = (await adsLibraryClient.query(
        anyApi.snapshots.getLatestSnapshot,
        { ad_id: found.adId }
      )) as ConvexSnapshot | null;
    } catch (err) {
      console.warn(
        "[metrics] snapshots.getLatestSnapshot failed",
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
