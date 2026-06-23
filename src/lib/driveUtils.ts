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

/**
 * Poster frame for a video card. The R2 `thumbs/` bucket only holds stills
 * for *image* assets, not video frames, so for Drive-hosted videos we pull a
 * poster from Google Drive's thumbnail endpoint (served via the lh3 CDN).
 * fal.ai-hosted videos are bare full URLs with no still-frame source, so we
 * return null and the caller falls back to a placeholder.
 *
 * Cards must use this instead of mounting a <video> element — rendering
 * hundreds of decoding <video> tags is what makes the gallery a memory hog.
 */
export function getVideoPosterUrl(
  videoRef: string | null | undefined,
  size = 640
): string | null {
  if (!videoRef) return null;
  if (isFullUrl(videoRef)) return null;
  return `https://drive.google.com/thumbnail?id=${videoRef}&sz=w${size}`;
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
