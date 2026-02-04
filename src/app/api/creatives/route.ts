import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { fetchCreatives } from "@/lib/sheets";
import { ApiResponse } from "@/lib/types";

const CACHE_KEY = "creatives";

export async function GET() {
  try {
    const ttl = parseInt(process.env.CACHE_TTL_SECONDS || "300", 10);

    let data = cache.get<ApiResponse>(CACHE_KEY);
    if (!data) {
      data = await fetchCreatives();
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
