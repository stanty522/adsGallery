import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

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

async function getFileTypesFromSheet(): Promise<Map<string, "thumb" | "video">> {
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

  const typeMap = new Map<string, "thumb" | "video">();

  for (const row of rows) {
    const link916 = extractFileId(row[23]);
    const link45 = extractFileId(row[24]);
    const link45Static = extractFileId(row[25]);
    const carouselIds = [row[26], row[27], row[28], row[29]].map(extractFileId);

    if (link916) typeMap.set(link916, "video");
    if (link45) typeMap.set(link45, "video");
    if (link45Static) typeMap.set(link45Static, "thumb");
    for (const cid of carouselIds) {
      if (cid) typeMap.set(cid, "thumb");
    }
  }

  return typeMap;
}

export async function POST() {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_CONVEX_URL" }, { status: 500 });
    }

    // Read migration state file
    const statePath = path.join(process.cwd(), "scripts", "migration-state.json");
    if (!fs.existsSync(statePath)) {
      return NextResponse.json({ error: "No migration-state.json found" }, { status: 404 });
    }

    const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    const completedIds: string[] = state.completed || [];

    if (completedIds.length === 0) {
      return NextResponse.json({ message: "No completed migrations to seed", seeded: 0 });
    }

    // Get file types from sheet
    const typeMap = await getFileTypesFromSheet();

    // Check what's already in Convex
    const convex = new ConvexHttpClient(convexUrl);
    const existingIds = await convex.query(api.sync.getProcessedIds);
    const existingSet = new Set(existingIds);

    // Filter to only new IDs
    const newIds = completedIds.filter((id) => !existingSet.has(id));

    if (newIds.length === 0) {
      return NextResponse.json({
        message: "All migrations already seeded",
        seeded: 0,
        existing: existingIds.length,
      });
    }

    // Build file entries with types
    const files: FileEntry[] = newIds.map((id) => ({
      id,
      type: typeMap.get(id) || "thumb", // default to thumb if unknown
    }));

    // Batch insert (Convex has limits, so chunk if needed)
    const BATCH_SIZE = 100;
    let seeded = 0;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await convex.mutation(api.sync.markAsProcessed, {
        files: batch.map((f) => ({ fileId: f.id, type: f.type })),
      });
      seeded += batch.length;
    }

    return NextResponse.json({
      message: `Seeded ${seeded} file records into Convex`,
      seeded,
      existing: existingIds.length,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
