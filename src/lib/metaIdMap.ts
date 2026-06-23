import { cache } from "./cache";

/**
 * Most ads in the meow-ads-library Convex deployment have no `meta_ad_id`
 * (only ~5% are linked). The Meta upload tracker spreadsheet maps each
 * creative_name to the Meta ad id it was uploaded as, which lets us recover
 * the id for ~94% of the gallery and fetch live performance for them.
 *
 * Source: "Sheet1" of the Meta ID sheet — col AH = creative_name,
 * col AL = uploaded_ad_id. Range AH2:AL spans both (AH..AL = 5 columns).
 */
const SHEET_ID =
  process.env.META_ID_SHEET_ID ||
  "1mIFcyxv7UnJnNIYuFFnBDRAOyAGrid1GIq8NsVXwSTQ";
const RANGE = "Sheet1!AH2:AL";
const CACHE_KEY = "meta_id_map_v1";
const TTL = 3600; // 1h — the sheet changes only when new ads are uploaded

const CREATIVE_NAME_COL = 0; // AH
const UPLOADED_AD_ID_COL = 4; // AL

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

async function buildMap(): Promise<Map<string, string>> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("[metaIdMap] GOOGLE_API_KEY not set; cannot load Meta id map.");
    return new Map();
  }

  const range = encodeURIComponent(RANGE);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.warn(
      `[metaIdMap] Sheets API error ${res.status}; Meta id enrichment disabled.`
    );
    return new Map();
  }

  const data = (await res.json()) as { values?: string[][] };
  const rows = data.values ?? [];
  const map = new Map<string, string>();
  for (const row of rows) {
    const name = normalizeName(row[CREATIVE_NAME_COL] ?? "");
    const adId = (row[UPLOADED_AD_ID_COL] ?? "").trim();
    // First write wins so the earliest upload of a name is the canonical id.
    if (name && adId && !map.has(name)) map.set(name, adId);
  }
  return map;
}

/**
 * Returns the cached creative_name -> meta_ad_id map. Cached in-memory for an
 * hour; failures return an empty map so callers degrade gracefully.
 */
export async function getMetaIdMap(): Promise<Map<string, string>> {
  const cached = cache.get<Map<string, string>>(CACHE_KEY);
  if (cached) return cached;
  const map = await buildMap();
  // Cache even an empty map briefly to avoid hammering the Sheets API on errors.
  cache.set(CACHE_KEY, map, map.size > 0 ? TTL : 60);
  return map;
}

// Drop a trailing "copy" / "copy 2" / "-copy" that Meta appends to duplicated
// ads but the gallery name usually omits (or vice-versa).
function stripCopySuffix(n: string): string {
  return n.replace(/[\s_-]*copy(\s*\d+)?$/i, "").trim();
}

/**
 * Resolve a creative name to a Meta ad id: exact normalized match first, then
 * best-effort fuzzy (copy-suffix stripped, then prefix containment) to recover
 * the ads whose names don't line up exactly with the sheet.
 */
export function resolveMetaId(
  name: string,
  map: Map<string, string>
): string | null {
  const n = normalizeName(name);
  if (!n) return null;

  const exact = map.get(n);
  if (exact) return exact;

  const stripped = stripCopySuffix(n);
  if (stripped && stripped !== n) {
    const v = map.get(stripped);
    if (v) return v;
  }

  // Fuzzy: copy-suffix-equal or one name is a prefix of the other. Guard on
  // length so short names don't collide into false positives.
  if (n.length >= 8) {
    for (const [k, id] of map) {
      if (k.length < 8) continue;
      if (stripCopySuffix(k) === stripped) return id;
      if (k.startsWith(n) || n.startsWith(k)) return id;
    }
  }
  return null;
}

export async function getMetaIdByName(name: string): Promise<string | null> {
  if (!name) return null;
  const map = await getMetaIdMap();
  return resolveMetaId(name, map);
}
