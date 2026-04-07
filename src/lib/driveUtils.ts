const DRIVE_FILE_ID_REGEX = /\/file\/d\/([a-zA-Z0-9_-]+)/;

const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || "";

/**
 * Detect if a string is a full HTTP(S) URL (vs a bare Drive file ID).
 * Asset reference fields on Creative may hold either form: legacy ads
 * use Drive IDs (which we proxy through R2 CDN), and experimental ads
 * use full URLs (e.g. fal.ai-hosted videos).
 */
function isFullUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function extractDriveFileId(url: string | undefined | null): string | null {
  if (!url || url === "Not found" || url.trim() === "") return null;
  const match = url.match(DRIVE_FILE_ID_REGEX);
  return match ? match[1] : null;
}

/**
 * Resolve an asset reference (Drive ID or full URL) to a usable asset URL.
 * Used by adsLibrary's adapter so that experimental ads with full fal.ai
 * URLs survive the migration without needing R2 sync.
 */
export function resolveAssetReference(
  url: string | undefined | null
): string | null {
  if (!url || url === "Not found" || url.trim() === "") return null;
  const driveId = extractDriveFileId(url);
  if (driveId) return driveId;
  // Pass through full URLs unchanged. Bare strings that aren't URLs and
  // don't match the Drive pattern are treated as invalid.
  if (isFullUrl(url)) return url;
  return null;
}

export function getDriveThumbnailUrl(fileIdOrUrl: string): string {
  if (isFullUrl(fileIdOrUrl)) return fileIdOrUrl;
  return `${CDN_URL}/thumbs/${fileIdOrUrl}.jpg`;
}

export function getDriveEmbedUrl(fileIdOrUrl: string): string {
  if (isFullUrl(fileIdOrUrl)) return fileIdOrUrl;
  return `${CDN_URL}/videos/${fileIdOrUrl}.mp4`;
}

export function getBestThumbnailId(creative: {
  link916: string | null;
  link45: string | null;
  link45Static: string | null;
  carouselImages: string[];
}): string | null {
  return (
    creative.link45Static ||
    creative.link45 ||
    creative.link916 ||
    creative.carouselImages[0] ||
    null
  );
}

export function getBestVideoId(creative: {
  link916: string | null;
  link45: string | null;
}): string | null {
  return creative.link916 || creative.link45 || null;
}
