import { Creative, FilterOptions, ApiResponse } from "./types";
import { extractDriveFileId } from "./driveUtils";

const KNOWN_META_FORMATS = ["video", "image", "carousel"];

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
  // Infer from available links
  if (carouselImages.length > 0) return "carousel";
  if (link916 || link45) return "video";
  return "image";
}

function parseRow(row: string[], index: number): Creative | null {
  const name = row[0]?.trim();
  if (!name || name.length < 3) return null;

  const link916 = extractDriveFileId(row[23]);
  const link45 = extractDriveFileId(row[24]);
  const link45Static = extractDriveFileId(row[25]);

  const carouselImages = [row[26], row[27], row[28], row[29]]
    .map((url) => extractDriveFileId(url))
    .filter((id): id is string => id !== null);

  const metaFormat = normalizeMetaFormat(
    row[13],
    carouselImages,
    link916,
    link45
  );

  // Must have at least one displayable asset
  if (!link916 && !link45 && !link45Static && carouselImages.length === 0) {
    return null;
  }

  return {
    id: index,
    name,
    creativeType: row[1]?.trim().toLowerCase() || "unknown",
    creativeFormat: row[2]?.trim().toLowerCase() || "unknown",
    platform: row[3]?.trim().toLowerCase() || "unknown",
    aiActor: row[4]?.trim() || "",
    cameraAngle: row[5]?.trim() || "",
    metaFormat,
    link916,
    link45,
    link45Static,
    carouselImages,
  };
}

export async function fetchCreatives(): Promise<ApiResponse> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || "Sheet1";

  if (!apiKey || !spreadsheetId) {
    throw new Error("Missing GOOGLE_API_KEY or SPREADSHEET_ID env vars");
  }

  const range = encodeURIComponent(`${sheetName}!A2:AD`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Sheets API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  const creatives: Creative[] = [];
  const typesSet = new Set<string>();
  const formatsSet = new Set<string>();
  const platformsSet = new Set<string>();
  const metaFormatsSet = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const creative = parseRow(rows[i], i);
    if (!creative) continue;

    creatives.push(creative);
    typesSet.add(creative.creativeType);
    formatsSet.add(creative.creativeFormat);
    platformsSet.add(creative.platform);
    metaFormatsSet.add(creative.metaFormat);
  }

  // Most recent first (sheet rows are chronological, newest at bottom)
  creatives.reverse();

  const filters: FilterOptions = {
    creativeTypes: Array.from(typesSet).sort(),
    creativeFormats: Array.from(formatsSet).sort(),
    platforms: Array.from(platformsSet).sort(),
    metaFormats: Array.from(metaFormatsSet).sort(),
  };

  return { creatives, filters };
}
