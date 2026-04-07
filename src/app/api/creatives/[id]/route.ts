import { NextRequest, NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { fetchCreativeDetailById, CreativeDetail } from "@/lib/adsLibrary";

const DETAIL_CACHE_PREFIX = "creative_detail_";
const DETAIL_TTL = 3600; // 1 hour — detail fields rarely change

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const cacheKey = `${DETAIL_CACHE_PREFIX}${id}`;
  const cached = cache.get<CreativeDetail>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const detail = await fetchCreativeDetailById(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    cache.set(cacheKey, detail, DETAIL_TTL);
    return NextResponse.json(detail);
  } catch (error) {
    console.error("Failed to fetch creative detail:", error);
    return NextResponse.json(
      { error: "Failed to load creative detail" },
      { status: 500 }
    );
  }
}
