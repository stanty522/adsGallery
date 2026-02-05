import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { downloadFromDrive } from "@/lib/drive-download";
import { uploadToR2 } from "@/lib/r2";

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

async function collectFileIdsFromSheets(): Promise<FileEntry[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || "Sheet1";

  if (!apiKey || !spreadsheetId) {
    throw new Error("Missing GOOGLE_API_KEY or SPREADSHEET_ID");
  }

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

async function processFile(entry: FileEntry): Promise<boolean> {
  const { id, type } = entry;

  try {
    const data = await downloadFromDrive(id);

    if (type === "thumb") {
      await uploadToR2(`thumbs/${id}.jpg`, data, "image/jpeg");
    } else {
      await uploadToR2(`videos/${id}.mp4`, data, "video/mp4");
    }

    return true;
  } catch (err) {
    console.error(`Failed to process ${id}:`, err);
    return false;
  }
}

export async function POST() {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_CONVEX_URL" },
        { status: 500 }
      );
    }

    const convex = new ConvexHttpClient(convexUrl);

    // 1. Fetch all file IDs from Google Sheets
    const allFiles = await collectFileIdsFromSheets();
    console.log(`Found ${allFiles.length} total files in sheet`);

    // 2. Get already-processed IDs from Convex
    const processedIds = await convex.query(api.sync.getProcessedIds);
    const processedSet = new Set(processedIds);
    console.log(`Already synced: ${processedSet.size} files`);

    // 3. Filter to only new files
    const newFiles = allFiles.filter((f) => !processedSet.has(f.id));
    console.log(`New files to sync: ${newFiles.length}`);

    if (newFiles.length === 0) {
      return NextResponse.json({
        processed: 0,
        failed: [],
        message: "No new files to sync",
      });
    }

    // 4. Process each new file
    const processed: FileEntry[] = [];
    const failed: string[] = [];

    for (const file of newFiles) {
      const success = await processFile(file);
      if (success) {
        processed.push(file);
      } else {
        failed.push(file.id);
      }
    }

    // 5. Mark successfully processed files in Convex
    if (processed.length > 0) {
      await convex.mutation(api.sync.markAsProcessed, {
        files: processed.map((f) => ({ fileId: f.id, type: f.type })),
      });
    }

    return NextResponse.json({
      processed: processed.length,
      failed,
      message: `Synced ${processed.length} files${failed.length > 0 ? `, ${failed.length} failed` : ""}`,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to trigger sync",
    usage: "POST /api/sync",
  });
}
