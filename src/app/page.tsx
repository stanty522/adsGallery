import Gallery from "@/components/Gallery";
import { fetchCreatives } from "@/lib/adsLibrary";
import { MetaAdStatus } from "@/lib/types";

// ISR: regenerate the page every hour. Most users hit pre-rendered
// HTML for instant first paint. The "Sync" button can force-refresh
// via /api/creatives?refresh=true if data is stale.
export const revalidate = 3600;

function mapConvexStatus(s: string | undefined): MetaAdStatus {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "live" || lower === "active") return "ACTIVE";
  if (lower === "paused") return "PAUSED";
  if (lower === "archived") return "ARCHIVED";
  if (lower === "deleted") return "DELETED";
  return null;
}

export default async function Home() {
  // Server-side fetch — runs at build time (or on revalidation) so the
  // HTML response includes all creatives inline. No client-side waterfall.
  const data = await fetchCreatives();
  const initialCreatives = data.creatives.map((c) => ({
    ...c,
    metaAdStatus: mapConvexStatus(c.status),
  }));

  return (
    <main className="min-h-screen">
      <Gallery
        initialCreatives={initialCreatives}
        initialFilters={data.filters}
      />
    </main>
  );
}
