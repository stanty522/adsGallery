/**
 * One-time maintenance: re-mux R2 `videos/*.mp4` so the moov atom is at the
 * FRONT of the file (`-movflags +faststart`). The gallery's videos currently
 * have moov at the end, so browsers must fetch the tail of a ~25MB file before
 * playback can start — this is the "videos take long to load" problem.
 *
 * Re-muxing is lossless and fast: `-c copy` just relocates the moov atom, no
 * re-encode. Idempotent — already-faststart files are skipped.
 *
 * Requires: ffmpeg + ffprobe on PATH. Reads creds from .env.local.
 *
 * Usage:
 *   node scripts/remux-faststart.mjs --dry-run        # report only
 *   node scripts/remux-faststart.mjs --limit 20       # process first 20
 *   node scripts/remux-faststart.mjs                  # process all
 */
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fs from "node:fs";

const execFileP = promisify(execFile);

function loadEnv() {
  const text = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const get = (k) =>
    (text.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] || "")
      .trim()
      .replace(/^["']|["']$/g, "");
  return {
    endpoint: get("R2_ENDPOINT"),
    accessKeyId: get("R2_ACCESS_KEY_ID"),
    secretAccessKey: get("R2_SECRET_ACCESS_KEY"),
    bucket: get("R2_BUCKET_NAME"),
  };
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;

const env = loadEnv();
const s3 = new S3Client({
  region: "auto",
  endpoint: env.endpoint,
  credentials: {
    accessKeyId: env.accessKeyId,
    secretAccessKey: env.secretAccessKey,
  },
});

async function listVideoKeys() {
  const keys = [];
  let token;
  do {
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.bucket,
        Prefix: "videos/",
        ContinuationToken: token,
      })
    );
    for (const o of out.Contents ?? []) {
      if (o.Key?.endsWith(".mp4")) keys.push(o.Key);
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function toBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

// ffprobe reports the major brand / nothing reliable for moov position, so we
// scan the first 1MB: if `mdat` appears before `moov`, it's not faststart.
function isFaststart(buf) {
  const head = buf.subarray(0, Math.min(buf.length, 1_000_000));
  const moov = head.indexOf("moov");
  const mdat = head.indexOf("mdat");
  return moov !== -1 && (mdat === -1 || moov < mdat);
}

async function processKey(key, dir) {
  // Cheap check first: fetch only the first 1MB to see if moov is already at
  // the front. Skips re-downloading the whole file on idempotent re-runs.
  const head = await s3.send(
    new GetObjectCommand({ Bucket: env.bucket, Key: key, Range: "bytes=0-1048575" })
  );
  if (isFaststart(await toBuffer(head.Body))) return "skip-already-faststart";
  if (dryRun) return "would-remux";

  const obj = await s3.send(
    new GetObjectCommand({ Bucket: env.bucket, Key: key })
  );
  const input = await toBuffer(obj.Body);

  const inPath = join(dir, "in.mp4");
  const outPath = join(dir, "out.mp4");
  await writeFile(inPath, input);
  await execFileP("ffmpeg", [
    "-y",
    "-i",
    inPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outPath,
  ]);
  const output = await readFile(outPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: output,
      ContentType: "video/mp4",
    })
  );
  await rm(inPath, { force: true });
  await rm(outPath, { force: true });
  return "remuxed";
}

async function main() {
  const keys = (await listVideoKeys()).slice(0, limit);
  console.log(`Found ${keys.length} video(s) to inspect${dryRun ? " (dry run)" : ""}.`);
  const dir = await mkdtemp(join(tmpdir(), "remux-"));
  const counts = {};
  let i = 0;
  for (const key of keys) {
    i++;
    try {
      const result = await processKey(key, dir);
      counts[result] = (counts[result] || 0) + 1;
      if (i % 25 === 0 || result === "remuxed" || result === "would-remux") {
        console.log(`[${i}/${keys.length}] ${key} -> ${result}`);
      }
    } catch (err) {
      counts.error = (counts.error || 0) + 1;
      console.error(`[${i}/${keys.length}] ${key} -> ERROR ${err.message}`);
    }
  }
  await rm(dir, { recursive: true, force: true });
  console.log("Done:", JSON.stringify(counts));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
