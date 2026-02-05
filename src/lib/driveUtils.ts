const DRIVE_FILE_ID_REGEX = /\/file\/d\/([a-zA-Z0-9_-]+)/;

const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || "";

export function extractDriveFileId(url: string | undefined | null): string | null {
  if (!url || url === "Not found" || url.trim() === "") return null;
  const match = url.match(DRIVE_FILE_ID_REGEX);
  return match ? match[1] : null;
}

export function getDriveThumbnailUrl(fileId: string): string {
  return `${CDN_URL}/thumbs/${fileId}.jpg`;
}

export function getDriveEmbedUrl(fileId: string): string {
  return `${CDN_URL}/videos/${fileId}.mp4`;
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
