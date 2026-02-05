import { CampaignMetrics } from "./types";

const META_API_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
  };
}

interface MetaAdsResponse {
  data: MetaAd[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
  error?: {
    message: string;
    code: number;
  };
}

export interface AdStatusMap {
  [normalizedName: string]: {
    status: string;
    adId: string;
    originalName: string;
  };
}

export interface MetaAdInsight {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  actions: { action_type: string; value: string }[];
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function fetchMetaAds(
  accessToken: string,
  adAccountId: string
): Promise<MetaAd[]> {
  // Simplified fields to avoid "reduce data" error
  const fields = "id,name,status,effective_status";
  const url = `${META_BASE_URL}/act_${adAccountId}/ads?fields=${fields}&limit=100&access_token=${accessToken}`;

  const res = await fetch(url);
  const data: MetaAdsResponse = await res.json();

  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message}`);
  }

  // Handle pagination if needed
  let allAds = data.data || [];
  let nextUrl = data.paging?.next;

  while (nextUrl) {
    const nextRes = await fetch(nextUrl);
    const nextData: MetaAdsResponse = await nextRes.json();
    if (nextData.error) break;
    allAds = [...allAds, ...(nextData.data || [])];
    nextUrl = nextData.paging?.next;
  }

  return allAds;
}

export function buildAdStatusMap(ads: MetaAd[]): AdStatusMap {
  const map: AdStatusMap = {};

  for (const ad of ads) {
    const normalized = normalizeName(ad.name);
    // Use effective_status as it reflects the actual running state
    map[normalized] = {
      status: ad.effective_status || ad.status,
      adId: ad.id,
      originalName: ad.name,
    };
  }

  return map;
}

export function matchCreativeToAd(
  creativeName: string,
  adStatusMap: AdStatusMap
): { status: string; adId: string } | null {
  const normalizedCreative = normalizeName(creativeName);

  // Exact match
  if (adStatusMap[normalizedCreative]) {
    return {
      status: adStatusMap[normalizedCreative].status,
      adId: adStatusMap[normalizedCreative].adId,
    };
  }

  // Partial match: creative name contains ad name or vice versa
  for (const [normalizedAdName, adInfo] of Object.entries(adStatusMap)) {
    if (
      normalizedCreative.includes(normalizedAdName) ||
      normalizedAdName.includes(normalizedCreative)
    ) {
      return {
        status: adInfo.status,
        adId: adInfo.adId,
      };
    }
  }

  return null;
}

// Find ALL ads matching a creative (including "copy" variants)
export function findAllMatchingAds(
  creativeName: string,
  adStatusMap: AdStatusMap
): { adId: string; originalName: string }[] {
  const normalizedCreative = normalizeName(creativeName);
  const matches: { adId: string; originalName: string }[] = [];

  for (const [normalizedAdName, adInfo] of Object.entries(adStatusMap)) {
    // Exact match
    if (normalizedAdName === normalizedCreative) {
      matches.push({ adId: adInfo.adId, originalName: adInfo.originalName });
      continue;
    }
    // Match with "copy" suffix: "creative name copy" or "creative name copy 2"
    if (normalizedAdName.startsWith(normalizedCreative + " copy")) {
      matches.push({ adId: adInfo.adId, originalName: adInfo.originalName });
      continue;
    }
    // Reverse: ad name is the base of creative name
    if (normalizedCreative.startsWith(normalizedAdName + " copy")) {
      matches.push({ adId: adInfo.adId, originalName: adInfo.originalName });
    }
  }

  return matches;
}

// Fetch insights for multiple ads using batch API
export async function fetchAdInsights(
  accessToken: string,
  adIds: string[]
): Promise<MetaAdInsight[]> {
  if (adIds.length === 0) return [];

  // Use batch requests for efficiency (up to 50 per batch)
  const batches: string[][] = [];
  for (let i = 0; i < adIds.length; i += 50) {
    batches.push(adIds.slice(i, i + 50));
  }

  const allInsights: MetaAdInsight[] = [];

  for (const batch of batches) {
    const batchRequests = batch.map((adId) => ({
      method: "GET",
      relative_url: `${adId}?fields=id,name,campaign{id,name,objective},insights.date_preset(maximum){spend,impressions,clicks,actions}`,
    }));

    const response = await fetch(
      `${META_BASE_URL}/?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: batchRequests }),
      }
    );

    const results = await response.json();

    for (const result of results) {
      if (result.code === 200) {
        const data = JSON.parse(result.body);
        const insight = data.insights?.data?.[0];

        allInsights.push({
          adId: data.id,
          adName: data.name,
          campaignId: data.campaign?.id || "",
          campaignName: data.campaign?.name || "",
          objective: data.campaign?.objective || "UNKNOWN",
          spend: parseFloat(insight?.spend || "0"),
          impressions: parseInt(insight?.impressions || "0", 10),
          clicks: parseInt(insight?.clicks || "0", 10),
          actions: insight?.actions || [],
        });
      }
    }
  }

  return allInsights;
}

// Map Meta objectives to our simplified types
function getObjectiveType(objective: string): "lead" | "purchase" | "other" {
  const upper = objective.toUpperCase();
  if (upper.includes("LEAD")) return "lead";
  if (
    upper.includes("PURCHASE") ||
    upper.includes("CONVERSIONS") ||
    upper.includes("PRODUCT_CATALOG_SALES")
  ) {
    return "purchase";
  }
  return "other";
}

// Aggregate insights by campaign objective
export function aggregateByObjective(
  insights: MetaAdInsight[]
): CampaignMetrics[] {
  const groups: Record<string, MetaAdInsight[]> = {};

  for (const insight of insights) {
    const type = getObjectiveType(insight.objective);
    if (!groups[type]) groups[type] = [];
    groups[type].push(insight);
  }

  return Object.entries(groups).map(([type, items]) => {
    const spent = items.reduce((sum, i) => sum + i.spend, 0);
    const impressions = items.reduce((sum, i) => sum + i.impressions, 0);
    const clicks = items.reduce((sum, i) => sum + i.clicks, 0);

    // Extract results based on objective type
    // Use exact match to avoid double-counting (Meta returns same conversions under multiple action types)
    let results = 0;
    for (const item of items) {
      // For leads: use "lead" action type
      // For purchases: use "purchase" action type (the standard pixel event)
      const targetActionType = type === "lead" ? "lead" : "purchase";

      const action = item.actions.find((a) => a.action_type === targetActionType);
      if (action) {
        results += parseInt(action.value || "0", 10);
      }
    }

    return {
      campaignType: type as "lead" | "purchase" | "other",
      spent,
      results,
      costPerResult: results > 0 ? spent / results : 0,
      impressions,
      clicks,
      cpm: impressions > 0 ? (spent / impressions) * 1000 : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      matchedAds: items.length,
    };
  });
}
