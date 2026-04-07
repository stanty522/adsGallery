import { Creative, FilterOptions, ApiResponse, AdCopy } from "./types";
import { resolveAssetReference } from "./driveUtils";
import adsLibraryClient from "./convexClient";
import { anyApi } from "convex/server";

const KNOWN_META_FORMATS = ["video", "image", "carousel"];
const ACCOUNT = "meow-mobile";

// Shape of a row from convex `ads` table (loose typing — we treat it as
// untyped JSON since we're calling via the HTTP client without generated types).
interface ConvexAdRow {
  _id: string;
  _creationTime: number;
  creative_name: string;
  hook_type?: string;
  script?: string;
  account: string;
  status?: string;
  created_at?: number;
  meta_ad_id?: string;
  thumbnail_url?: string;
  subtitled_video_url_9x16?: string;
  subtitled_video_url_4x5?: string;
  static_image_url?: string;
  carousel_image_urls?: string[];
  creative_type?: string;
  creative_format?: string;
  platform?: string;
  ai_actor?: string;
  camera_angle?: string;
  meta_format?: string;
  headline?: string;
  primary_text?: string;
  description?: string;
  hypothesis_id?: string;
  parent_winner_id?: string;
  experiment_cycle?: string;
  experiment_variant?: string;
}

function normalizeMetaFormat(
  raw: string | undefined,
  carouselImages: string[],
  link916: string | null,
  link45: string | null
): "video" | "image" | "carousel" {
  if (raw) {
    const lower = raw.toLowerCase().trim();
    if (KNOWN_META_FORMATS.includes(lower)) {
      return lower as "video" | "image" | "carousel";
    }
  }
  if (carouselImages.length > 0) return "carousel";
  if (link916 || link45) return "video";
  return "image";
}

function mapAdToCreative(ad: ConvexAdRow, index: number): Creative | null {
  const name = ad.creative_name?.trim();
  if (!name) return null;

  // Asset fields may contain either a Drive file ID (legacy) or a full URL
  // (experimental ads with fal.ai-hosted videos). resolveAssetReference
  // returns whichever is appropriate; the helper functions in driveUtils
  // detect and handle both forms downstream.
  const link916 = resolveAssetReference(ad.subtitled_video_url_9x16);
  const link45 = resolveAssetReference(ad.subtitled_video_url_4x5);
  const link45Static = resolveAssetReference(ad.static_image_url);

  const carouselImages = (ad.carousel_image_urls ?? [])
    .map((u) => resolveAssetReference(u))
    .filter((ref): ref is string => ref !== null);

  // Skip ads with no displayable assets (legacy parity with sheets.ts).
  if (!link916 && !link45 && !link45Static && carouselImages.length === 0) {
    return null;
  }

  const metaFormat = normalizeMetaFormat(
    ad.meta_format,
    carouselImages,
    link916,
    link45
  );

  const adCopy: AdCopy = {
    headline: ad.headline?.trim() || null,
    primaryText: ad.primary_text?.trim() || null,
    description: ad.description?.trim() || null,
    script: ad.script?.trim() || null,
  };

  return {
    id: index,
    name,
    creativeType: ad.creative_type?.trim().toLowerCase() || "unknown",
    creativeFormat: ad.creative_format?.trim().toLowerCase() || "unknown",
    platform: ad.platform?.trim().toLowerCase() || "unknown",
    aiActor: ad.ai_actor?.trim() || "",
    cameraAngle: ad.camera_angle?.trim() || "",
    metaFormat,
    link916,
    link45,
    link45Static,
    carouselImages,
    adCopy,
    metaAdId: ad.meta_ad_id || undefined,
    convexAdId: ad._id,
    hypothesisId: ad.hypothesis_id,
    parentWinnerId: ad.parent_winner_id,
    experimentCycle: ad.experiment_cycle,
    experimentVariant: ad.experiment_variant,
    status: ad.status,
  };
}

export async function fetchCreatives(): Promise<ApiResponse> {
  const ads = (await adsLibraryClient.query(anyApi.ads.listAdsByAccount, {
    account: ACCOUNT,
  })) as ConvexAdRow[];

  const creatives: Creative[] = [];
  const typesSet = new Set<string>();
  const formatsSet = new Set<string>();
  const platformsSet = new Set<string>();
  const metaFormatsSet = new Set<string>();

  // Sort by created_at ascending so reverse() below yields newest-first
  // (mirrors the legacy sheet ordering behavior).
  const sorted = [...ads].sort(
    (a, b) => (a.created_at ?? a._creationTime) - (b.created_at ?? b._creationTime)
  );

  for (let i = 0; i < sorted.length; i++) {
    const creative = mapAdToCreative(sorted[i], i);
    if (!creative) continue;
    creatives.push(creative);
    typesSet.add(creative.creativeType);
    formatsSet.add(creative.creativeFormat);
    platformsSet.add(creative.platform);
    metaFormatsSet.add(creative.metaFormat);
  }

  creatives.reverse();

  const filters: FilterOptions = {
    creativeTypes: Array.from(typesSet).sort(),
    creativeFormats: Array.from(formatsSet).sort(),
    platforms: Array.from(platformsSet).sort(),
    metaFormats: Array.from(metaFormatsSet).sort(),
  };

  return { creatives, filters };
}

/**
 * Lookup helper used by the metrics route: given a creative name, return
 * the convex ad _id (or null) so we can fetch its latest snapshot.
 */
export async function findConvexAdIdByName(
  creativeName: string
): Promise<{ adId: string; metaAdId?: string } | null> {
  const ads = (await adsLibraryClient.query(anyApi.ads.listAdsByAccount, {
    account: ACCOUNT,
  })) as ConvexAdRow[];

  const target = creativeName.toLowerCase().trim();
  // Exact match first
  let match = ads.find((a) => a.creative_name?.toLowerCase().trim() === target);
  // Fuzzy: gallery name is a prefix of convex ad name (or vice versa)
  if (!match) {
    match = ads.find((a) => {
      const n = a.creative_name?.toLowerCase().trim() ?? "";
      return n === target || n.startsWith(target) || target.startsWith(n);
    });
  }
  if (!match) return null;
  return { adId: match._id, metaAdId: match.meta_ad_id };
}
