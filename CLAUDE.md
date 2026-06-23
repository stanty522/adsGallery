# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A Next.js 16 (App Router, React 19, TypeScript strict) gallery for browsing ad creatives. Deployed on Vercel with Fastly edge caching in front.

## Commands

- `npm run dev` — local dev server
- `npm run build` — **non-standard**: `next build` then copies `.next/static` and `public/` into `.next/standalone/` (output is `standalone` mode). Don't replace with plain `next build` — the standalone server won't find static assets.
- `npm start` — runs the standalone server (`node .next/standalone/server.js`), not `next start`
- `npm run lint` — ESLint (`next lint`)

## Data & backend

- **Two Convex deployments.** The app's own deployment (`CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL`) holds local state (e.g. `syncedFiles` sync tracking, see `convex/schema.ts`). Creative data is read from a **separate, read-only** deployment, `meow-ads-library` (`MEOW_ADS_LIBRARY_CONVEX_URL`).
- Because `meow-ads-library` is read-only and has no generated types here, `src/lib/convexClient.ts` queries it via the **untyped** HTTP client (`anyApi()` / raw JSON) — there is no type safety on those responses. Validate shapes against `src/lib/types.ts` (`Creative`, etc.).
- Assets flow Google Sheets/Drive → Cloudflare R2 (`src/lib/r2.ts`, S3 SDK) → CDN. Meta Ads status is layered in via `src/lib/meta.ts`.

## Rendering & caching (don't break these)

- The home page (`src/app/page.tsx`) is **SSR'd with ISR** (`revalidate = 3600`) for instant first paint. `/api/creatives?refresh=true` forces a refresh.
- First-paint payload uses a **slim list mode** that strips detail-only fields (adCopy, experiment metadata, etc.); the detail panel lazy-fetches the full record via `/api/creatives`. Keep heavy fields out of the slim path.
- `next.config.js` overrides the `Vary` header and sets explicit `Cache-Control` (`s-maxage`/`stale-while-revalidate`) to avoid Fastly edge cache fragmentation. Changing cache headers or `Vary` can fragment or poison the edge cache.

## Env vars

Required keys are documented at the top of the relevant `src/lib/*` files (Google API, Convex x2, R2, Meta, CDN). Check there rather than assuming defaults; missing keys fail at request time, not build time.

## Repo etiquette

- **Never run a DB reset.**
- For SQL/schema changes, create the migration file (for `git push` deploys) but let the user apply it to local dev manually.
- Convex/edge functions deploy on `git push`, not via a separate deploy step.
- Avoid `git add .` — stage specific files only.
