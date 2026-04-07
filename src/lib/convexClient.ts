import { ConvexHttpClient } from "convex/browser";

// Points at the new meow-ads-library Convex deployment (Phase 4 migration).
// Kept separate from the legacy admired-wren-364 deployment which is still
// used by convex/syncJob.ts for the R2/Drive asset sync ledger.
const url = process.env.MEOW_ADS_LIBRARY_CONVEX_URL;

if (!url) {
  // Don't throw at import time — that would break next build. Defer to call time.
  console.warn(
    "[convexClient] MEOW_ADS_LIBRARY_CONVEX_URL is not set; ads library calls will fail."
  );
}

export const adsLibraryClient = new ConvexHttpClient(
  url || "https://fleet-finch-724.convex.cloud"
);

export default adsLibraryClient;
