import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

// Per-ad insight generation. Reads the fields that are easily available from
// the meow-ads-library Convex row and asks Claude (via the local Claude Code
// CLI, using its existing auth — no API key needed) for a short analyst take.
// Haiku keeps the panel responsive (~15s vs ~30s on Opus); bump to
// claude-opus-4-8 here if you want deeper analysis and can accept the latency.
const MODEL = "claude-haiku-4-5";

export interface InsightMetrics {
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpl?: number;
}

export interface InsightInput {
  name: string;
  creativeType?: string;
  creativeFormat?: string;
  hookType?: string;
  generation?: string;
  platform?: string;
  status?: string;
  metaFormat?: string;
  script?: string | null;
  headline?: string | null;
  primaryText?: string | null;
  description?: string | null;
  metrics?: InsightMetrics | null;
}

// Resolve the `claude` binary once. Falls back to bare "claude" (PATH lookup).
let claudeBin: string | null | undefined;
function resolveClaudeBin(): string | null {
  if (claudeBin !== undefined) return claudeBin;
  try {
    claudeBin = execFileSync("which", ["claude"]).toString().trim() || "claude";
  } catch {
    claudeBin = null; // not installed / not on PATH
  }
  return claudeBin;
}

export function insightsEnabled(): boolean {
  return resolveClaudeBin() !== null;
}

function buildFacts(input: InsightInput): string {
  const lines: string[] = [];
  lines.push(`Creative name: ${input.name}`);
  if (input.generation) lines.push(`Generation / experiment cycle: ${input.generation}`);
  if (input.creativeType) lines.push(`Creative type: ${input.creativeType}`);
  if (input.creativeFormat) lines.push(`Creative format: ${input.creativeFormat}`);
  if (input.metaFormat) lines.push(`Media: ${input.metaFormat}`);
  if (input.hookType) lines.push(`Hook type: ${input.hookType}`);
  if (input.platform) lines.push(`Platform: ${input.platform}`);
  if (input.status) lines.push(`Status: ${input.status}`);
  if (input.headline) lines.push(`Headline: ${input.headline}`);
  if (input.primaryText) lines.push(`Primary text: ${input.primaryText}`);
  if (input.description) lines.push(`Description: ${input.description}`);
  if (input.script) lines.push(`Video script:\n${input.script}`);
  if (input.metrics) {
    const m = input.metrics;
    const cpl = m.cpl ?? (m.leads > 0 ? m.spend / m.leads : null);
    lines.push(
      `Meta performance — spend $${m.spend.toFixed(0)}, ${m.leads} leads` +
        (cpl != null ? ` at $${cpl.toFixed(2)} CPL` : "") +
        `, ${m.impressions} impressions, ${m.clicks} clicks, ${m.ctr.toFixed(2)}% CTR`
    );
  } else {
    lines.push(
      "Meta performance: not launched / no performance data linked for this creative."
    );
  }
  return lines.join("\n");
}

const SYSTEM = `You are a senior paid-social creative strategist reviewing a single Meta ad creative for an internal team that browses its own ad library.

Write a tight 2-4 sentence analysis of THIS creative based only on the fields provided. Cover what the creative is doing (hook/angle/format), what stands out, and - if performance numbers are present - whether they look strong or weak and why. If no performance data is present, focus on the creative approach and give one concrete, actionable suggestion.

Rules: respond with the analysis only, no preamble, no headers, no bullet points, no markdown. Do not restate the raw fields. Do not invent metrics that were not provided.`;

export async function generateInsight(
  input: InsightInput
): Promise<string | null> {
  const bin = resolveClaudeBin();
  if (!bin) return null;

  const prompt = `Analyze this ad creative:\n\n${buildFacts(input)}`;
  try {
    const { stdout } = await execFileP(
      bin,
      [
        "-p",
        prompt,
        "--model",
        MODEL,
        "--append-system-prompt",
        SYSTEM,
        // Disable this session's MCP servers — otherwise the CLI spends 20-80s
        // connecting to / timing out on them (Asana, Gmail, posthog, …) on
        // every call. With this it's a steady ~14s.
        "--strict-mcp-config",
      ],
      { timeout: 90_000, maxBuffer: 1024 * 1024 }
    );
    return stdout.trim() || null;
  } catch (err) {
    console.warn("[insights] claude CLI failed:", err);
    return null;
  }
}
