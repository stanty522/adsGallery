import { NextRequest, NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { fetchCreatives } from "@/lib/sheets";
import { ApiResponse, MetaAdStatus } from "@/lib/types";
import {
  fetchMetaAds,
  buildAdStatusMap,
  matchCreativeToAd,
} from "@/lib/meta";

const CACHE_KEY = "creatives";
const META_CACHE_KEY = "meta_ads";

export async function GET(request: NextRequest) {
  try {
    const ttl = parseInt(process.env.CACHE_TTL_SECONDS || "300", 10);
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    if (refresh) {
      cache.delete(CACHE_KEY);
      cache.delete(META_CACHE_KEY);
    }

    let data = cache.get<ApiResponse>(CACHE_KEY);
    if (!data) {
      data = await fetchCreatives();
      cache.set(CACHE_KEY, data, ttl);
    }

    // Fetch Meta ads status and merge with creatives
    const accessToken = process.env.META_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    if (accessToken && adAccountId) {
      try {
        let adStatusMap = cache.get<ReturnType<typeof buildAdStatusMap>>(META_CACHE_KEY);

        if (!adStatusMap) {
          const metaAds = await fetchMetaAds(accessToken, adAccountId);
          adStatusMap = buildAdStatusMap(metaAds);
          cache.set(META_CACHE_KEY, adStatusMap, ttl);
        }

        // Merge Meta status into creatives
        data = {
          ...data,
          creatives: data.creatives.map((creative) => {
            const match = matchCreativeToAd(creative.name, adStatusMap!);
            if (match) {
              return {
                ...creative,
                metaAdStatus: match.status as MetaAdStatus,
                metaAdId: match.adId,
              };
            }
            return creative;
          }),
        };
      } catch (metaError) {
        console.error("Failed to fetch Meta ads:", metaError);
        // Continue without Meta status - don't fail the whole request
      }
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
      },
    });
  } catch (error) {
    console.error("Failed to fetch creatives:", error);
    return NextResponse.json(
      { error: "Failed to load creatives" },
      { status: 500 }
    );
  }
}
