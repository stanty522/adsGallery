import { NextRequest, NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import adsLibraryClient from "@/lib/convexClient";
import { anyApi } from "convex/server";
import {
  generateInsight,
  insightsEnabled,
  InsightInput,
  InsightMetrics,
} from "@/lib/insights";

const INSIGHT_CACHE_PREFIX = "insight_";
const INSIGHT_TTL = 86400; // 24h — insights only change if the ad's data changes

interface ConvexAdRow {
  _id: string;
  creative_name?: string;
  creative_type?: string;
  creative_format?: string;
  meta_format?: string;
  hook_type?: string;
  experiment_cycle?: string;
  platform?: string;
  status?: string;
  script?: string;
  headline?: string;
  primary_text?: string;
  description?: string;
  meta_ad_id?: string;
}

interface ConvexSnapshot {
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  leads: number;
  cpl?: number;
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (!insightsEnabled()) {
    // Surfaces a friendly state in the UI instead of an error when the
    // ANTHROPIC_API_KEY env var hasn't been configured.
    return NextResponse.json({ insight: null, enabled: false });
  }

  const cacheKey = `${INSIGHT_CACHE_PREFIX}${id}`;
  const cached = cache.get<{ insight: string | null; enabled: boolean }>(
    cacheKey
  );
  if (cached) return NextResponse.json(cached);

  try {
    const ad = (await adsLibraryClient.query(anyApi.ads.getById, {
      id,
    })) as ConvexAdRow | null;
    if (!ad) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Best-effort: pull the latest performance snapshot if the ad is linked.
    let metrics: InsightMetrics | null = null;
    if (ad.meta_ad_id) {
      try {
        const snap = (await adsLibraryClient.query(
          anyApi.snapshots.getLatestSnapshot,
          { ad_id: ad._id }
        )) as ConvexSnapshot | null;
        if (snap) {
          metrics = {
            spend: snap.spend,
            leads: snap.leads,
            impressions: snap.impressions,
            clicks: snap.clicks,
            ctr: snap.ctr,
            cpl: snap.cpl,
          };
        }
      } catch {
        /* snapshot query unavailable — proceed without metrics */
      }
    }

    const input: InsightInput = {
      name: ad.creative_name?.trim() || "Untitled creative",
      creativeType: ad.creative_type?.trim(),
      creativeFormat: ad.creative_format?.trim(),
      metaFormat: ad.meta_format?.trim(),
      hookType: ad.hook_type?.trim(),
      generation: ad.experiment_cycle?.trim(),
      platform: ad.platform?.trim(),
      status: ad.status?.trim(),
      script: ad.script?.trim() || null,
      headline: ad.headline?.trim() || null,
      primaryText: ad.primary_text?.trim() || null,
      description: ad.description?.trim() || null,
      metrics,
    };

    const insight = await generateInsight(input);
    const payload = { insight, enabled: true };
    if (insight) cache.set(cacheKey, payload, INSIGHT_TTL);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to generate creative insight:", error);
    return NextResponse.json(
      { error: "Failed to generate insight" },
      { status: 500 }
    );
  }
}
