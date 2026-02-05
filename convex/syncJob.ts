"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

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

async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Missing R2 credentials");
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export const run = internalAction({
  handler: async (ctx) => {
    console.log("[sync] Starting scheduled sync...");

    // 1. Fetch all file IDs from Google Sheets
    const allFiles = await collectFileIdsFromSheets();
    console.log(`[sync] Found ${allFiles.length} total files in sheet`);

    // 2. Get already-processed IDs from Convex
    const processedIds: string[] = await ctx.runQuery(internal.sync.getProcessedIdsInternal);
    const processedSet = new Set(processedIds);
    console.log(`[sync] Already synced: ${processedSet.size} files`);

    // 3. Filter to only new files
    const newFiles = allFiles.filter((f) => !processedSet.has(f.id));
    console.log(`[sync] New files to sync: ${newFiles.length}`);

    if (newFiles.length === 0) {
      console.log("[sync] No new files to sync");
      return { processed: 0, failed: [] };
    }

    // 4. Process each new file (limit to 10 per run to avoid timeouts)
    const batch = newFiles.slice(0, 10);
    const processed: FileEntry[] = [];
    const failed: string[] = [];

    for (const file of batch) {
      try {
        const data = await downloadFromDrive(file.id);
        if (file.type === "thumb") {
          await uploadToR2(`thumbs/${file.id}.jpg`, data, "image/jpeg");
        } else {
          await uploadToR2(`videos/${file.id}.mp4`, data, "video/mp4");
        }
        processed.push(file);
        console.log(`[sync] ✓ ${file.id}`);
      } catch (err) {
        console.error(`[sync] ✗ ${file.id}:`, err);
        failed.push(file.id);
      }
    }

    // 5. Mark successfully processed files
    if (processed.length > 0) {
      await ctx.runMutation(internal.sync.markProcessedInternal, {
        files: processed.map((f) => ({ fileId: f.id, type: f.type })),
      });
    }

    console.log(`[sync] Done. Processed: ${processed.length}, Failed: ${failed.length}`);
    return { processed: processed.length, failed };
  },
});
