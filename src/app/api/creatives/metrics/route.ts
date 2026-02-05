import { NextRequest, NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import {
  fetchMetaAds,
  buildAdStatusMap,
  findAllMatchingAds,
  fetchAdInsights,
  aggregateByObjective,
} from "@/lib/meta";
import { CreativeMetrics } from "@/lib/types";

const METRICS_CACHE_PREFIX = "metrics_";
const METRICS_TTL = 3600; // 1 hour
const AD_MAP_CACHE_KEY = "ad_status_map";
const AD_MAP_TTL = 300; // 5 minutes for ad status map

export async function GET(request: NextRequest) {
  const creativeName = request.nextUrl.searchParams.get("name");
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!creativeName) {
    return NextResponse.json(
      { error: "Missing creative name parameter" },
      { status: 400 }
    );
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return NextResponse.json(
      { error: "Meta API not configured" },
      { status: 503 }
    );
  }

  const cacheKey = `${METRICS_CACHE_PREFIX}${creativeName.toLowerCase().trim()}`;

  if (refresh) {
    cache.delete(cacheKey);
  }

  // Check cache first
  let metrics = cache.get<CreativeMetrics>(cacheKey);
  if (metrics) {
    return NextResponse.json(metrics);
  }

  try {
    // Get or refresh ad status map (cached separately since it's shared)
    let adStatusMap = cache.get<ReturnType<typeof buildAdStatusMap>>(AD_MAP_CACHE_KEY);

    if (!adStatusMap || refresh) {
      const metaAds = await fetchMetaAds(accessToken, adAccountId);
      adStatusMap = buildAdStatusMap(metaAds);
      cache.set(AD_MAP_CACHE_KEY, adStatusMap, AD_MAP_TTL);
    }

    // Find all matching ads
    const matchingAds = findAllMatchingAds(creativeName, adStatusMap);

    if (matchingAds.length === 0) {
      metrics = {
        lastUpdated: new Date().toISOString(),
        campaigns: [],
        totalSpent: 0,
      };
    } else {
      // Fetch insights for all matched ads
      const adIds = matchingAds.map((a) => a.adId);
      const insights = await fetchAdInsights(accessToken, adIds);

      // Aggregate by objective
      const campaigns = aggregateByObjective(insights);
      const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);

      metrics = {
        lastUpdated: new Date().toISOString(),
        campaigns,
        totalSpent,
      };
    }

    cache.set(cacheKey, metrics, METRICS_TTL);
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Failed to fetch creative metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
