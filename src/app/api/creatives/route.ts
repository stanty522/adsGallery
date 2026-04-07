import { NextRequest, NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { fetchCreatives } from "@/lib/adsLibrary";
import { ApiResponse, MetaAdStatus } from "@/lib/types";

const CACHE_KEY = "creatives_v2";

// Map convex `status` strings to the gallery's MetaAdStatus enum so the
// existing UI status badges keep rendering.
function mapConvexStatus(s: string | undefined): MetaAdStatus {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "live" || lower === "active") return "ACTIVE";
  if (lower === "paused") return "PAUSED";
  if (lower === "archived") return "ARCHIVED";
  if (lower === "deleted") return "DELETED";
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const ttl = parseInt(process.env.CACHE_TTL_SECONDS || "300", 10);
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    if (refresh) {
      cache.delete(CACHE_KEY);
    }

    let data = cache.get<ApiResponse>(CACHE_KEY);
    if (!data) {
      data = await fetchCreatives();
      // Promote convex `status` into metaAdStatus so badges still render
      data = {
        ...data,
        creatives: data.creatives.map((c) => ({
          ...c,
          metaAdStatus: mapConvexStatus(c.status),
        })),
      };
      cache.set(CACHE_KEY, data, ttl);
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
