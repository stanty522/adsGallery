/**
 * Migration script: Google Drive media → Cloudflare R2
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 *
 * Downloads via public Google Drive URLs. Uses local thumbs when available.
 * Uploads to R2 via wrangler CLI (sequential, one at a time).
 *
 * Prerequisites:
 *   npx wrangler login
 *   npx wrangler r2 bucket create media
 *   Enable public access (r2.dev subdomain) via Cloudflare dashboard
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ---------- Config ----------

const BUCKET = "media";
const STATE_FILE = path.join(__dirname, "migration-state.json");
const THUMBS_DIR = path.resolve(__dirname, "../public/thumbs");
const TMP_DIR = path.join(__dirname, "tmp");

// ---------- Env loading ----------

function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ---------- Sheets fetching ----------

const DRIVE_FILE_ID_REGEX = /\/file\/d\/([a-zA-Z0-9_-]+)/;

function extractFileId(url: string | undefined | null): string | null {
  if (!url || url === "Not found" || url.trim() === "") return null;
  const match = url.match(DRIVE_FILE_ID_REGEX);
  return match ? match[1] : null;
}

interface FileEntry {
  id: string;
  type: "thumb" | "video";
}

async function collectFileIds(): Promise<FileEntry[]> {
  const apiKey = process.env.GOOGLE_API_KEY!;
  const spreadsheetId = process.env.SPREADSHEET_ID!;
  const sheetName = process.env.SHEET_NAME || "Sheet1";

  const range = encodeURIComponent(`${sheetName}!A2:AD`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
  const data = await res.json();
  const rows: string[][] = data.values || [];

  const seen = new Set<string>();
  const entries: FileEntry[] = [];

  function add(id: string | null, type: "thumb" | "video") {
    if (!id || seen.has(id)) return;
    seen.add(id);
    entries.push({ id, type });
  }

  for (const row of rows) {
    const link916 = extractFileId(row[23]);
    const link45 = extractFileId(row[24]);
    const link45Static = extractFileId(row[25]);
    const carouselIds = [row[26], row[27], row[28], row[29]].map(extractFileId);

    if (link916) add(link916, "video");
    if (link45) add(link45, "video");
    if (link45Static) add(link45Static, "thumb");
    for (const cid of carouselIds) {
      if (cid) add(cid, "thumb");
    }
  }

  return entries;
}

// ---------- State management ----------

interface MigrationState {
  completed: string[];
  failed: string[];
}

function loadState(): MigrationState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  }
  return { completed: [], failed: [] };
}

function saveState(state: MigrationState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------- Download from Drive ----------

async function downloadFromDrive(fileId: string): Promise<Buffer> {
  const exportUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(exportUrl, { redirect: "follow" });

  if (!res.ok) {
    throw new Error(`Drive download failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = await res.text();
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
    if (confirmMatch) {
      const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`;
      const res2 = await fetch(confirmUrl, { redirect: "follow" });
      if (!res2.ok) throw new Error(`Drive confirm download failed: ${res2.status}`);
      return Buffer.from(await res2.arrayBuffer());
    }
    throw new Error("Got HTML instead of file data");
  }

  return Buffer.from(await res.arrayBuffer());
}

// ---------- Upload to R2 via wrangler ----------

function uploadToR2(storagePath: string, localFile: string) {
  const cmd = `npx wrangler r2 object put "${BUCKET}/${storagePath}" --file "${localFile}" --remote`;
  execSync(cmd, { stdio: "pipe", timeout: 120_000 });
}

// ---------- Process files ----------

async function processFile(
  entry: FileEntry,
  state: MigrationState
): Promise<boolean> {
  const { id, type } = entry;
  if (state.completed.includes(id)) return true;

  try {
    let storagePath: string;
    let tmpFile: string;

    if (type === "thumb") {
      storagePath = `thumbs/${id}.jpg`;
      tmpFile = path.join(TMP_DIR, `${id}.jpg`);

      const localPath = path.join(THUMBS_DIR, `${id}.jpg`);
      if (fs.existsSync(localPath)) {
        // Use existing local thumbnail — just copy to tmp
        fs.copyFileSync(localPath, tmpFile);
        console.log(`  [local] ${id}.jpg`);
      } else {
        const data = await downloadFromDrive(id);
        fs.writeFileSync(tmpFile, data);
        console.log(`  [drive] ${id}.jpg`);
      }
    } else {
      storagePath = `videos/${id}.mp4`;
      tmpFile = path.join(TMP_DIR, `${id}.mp4`);

      const data = await downloadFromDrive(id);
      fs.writeFileSync(tmpFile, data);
      const sizeMB = (data.byteLength / 1024 / 1024).toFixed(1);
      console.log(`  [drive] ${id}.mp4 (${sizeMB}MB)`);
    }

    // Upload to R2 via wrangler
    uploadToR2(storagePath, tmpFile);
    console.log(`  [r2] ✓ ${storagePath}`);

    // Clean up tmp file
    fs.unlinkSync(tmpFile);

    state.completed.push(id);
    saveState(state);
    return true;
  } catch (err: any) {
    console.error(`  [FAIL] ${id}: ${err.message}`);
    if (!state.failed.includes(id)) {
      state.failed.push(id);
      saveState(state);
    }
    return false;
  }
}

// ---------- Main ----------

async function main() {
  // Ensure tmp directory exists
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  console.log("Collecting file IDs from Google Sheets...");
  const entries = await collectFileIds();

  const thumbs = entries.filter((e) => e.type === "thumb");
  const videos = entries.filter((e) => e.type === "video");
  console.log(
    `Found ${entries.length} unique files (${thumbs.length} thumbs, ${videos.length} videos)`
  );

  const state = loadState();
  state.failed = []; // retry previously failed

  const remainingThumbs = thumbs.filter(
    (e) => !state.completed.includes(e.id)
  );
  const remainingVideos = videos.filter(
    (e) => !state.completed.includes(e.id)
  );

  console.log(`Already completed: ${state.completed.length}`);
  console.log(
    `Remaining: ${remainingThumbs.length} thumbs, ${remainingVideos.length} videos`
  );

  if (remainingThumbs.length === 0 && remainingVideos.length === 0) {
    console.log("Nothing to migrate!");
    return;
  }

  let success = 0;
  let fail = 0;

  // Phase 1: Thumbnails (sequential via wrangler)
  if (remainingThumbs.length > 0) {
    console.log(`\n--- Phase 1: Thumbnails (${remainingThumbs.length}) ---\n`);
    for (const entry of remainingThumbs) {
      const ok = await processFile(entry, state);
      if (ok) success++;
      else fail++;
    }
    console.log(`\nThumbs done. Success: ${success}, Failed: ${fail}`);
  }

  // Phase 2: Videos (sequential via wrangler)
  if (remainingVideos.length > 0) {
    const prevSuccess = success;
    console.log(`\n--- Phase 2: Videos (${remainingVideos.length}) ---\n`);
    for (const entry of remainingVideos) {
      const ok = await processFile(entry, state);
      if (ok) success++;
      else fail++;
    }
    console.log(
      `\nVideos done. Success: ${success - prevSuccess}, Failed: ${fail}`
    );
  }

  console.log(`\n=== Complete ===`);
  console.log(
    `Total: ${success} succeeded, ${fail} failed out of ${entries.length}`
  );

  if (state.failed.length > 0) {
    console.log(`\nFailed IDs (${state.failed.length}):`);
    for (const id of state.failed) console.log(`  - ${id}`);
    console.log("\nRe-run to retry.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
