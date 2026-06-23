export type MetaAdStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | null;

export interface AdCopy {
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  script: string | null;
}

export interface CampaignMetrics {
  campaignType: "lead" | "purchase" | "other";
  spent: number;
  results: number;
  costPerResult: number;
  impressions: number;
  clicks: number;
  cpm: number;
  ctr: number;
  matchedAds: number;
}

export interface CreativeMetrics {
  lastUpdated: string;
  campaigns: CampaignMetrics[];
  totalSpent: number;
}

export interface Creative {
  id: number;
  name: string;
  creativeType: string;
  creativeFormat: string;
  platform: string;
  aiActor: string;
  cameraAngle: string;
  metaFormat: "video" | "image" | "carousel";
  link916: string | null;
  link45: string | null;
  link45Static: string | null;
  carouselImages: string[];
  metaAdStatus?: MetaAdStatus;
  metaAdId?: string;
  adCopy?: AdCopy;
  // New fields from Convex meow-ads-library (Phase 4 migration)
  convexAdId?: string;
  hypothesisId?: string;
  parentWinnerId?: string;
  experimentCycle?: string;
  experimentVariant?: string;
  status?: string;
  // Generation bucket for the gallery filter: the ad's experiment_cycle
  // (e.g. "e12") when present, else a created_at month bucket (e.g. "Apr 2026").
  generation?: string;
  // Grid-level Meta performance, baked into the slim list for filtering/badges.
  campaignType?: "lead" | "purchase" | "other";
  costPerResult?: number; // CPL for lead campaigns, CPP for purchase campaigns
  results?: number;
  isWinner?: boolean; // lead CPL ≤ $5, or purchase CPP ≤ $150
}

export interface FilterOptions {
  creativeTypes: string[];
  creativeFormats: string[];
  platforms: string[];
  metaFormats: string[];
  generations: string[];
}

export interface ApiResponse {
  creatives: Creative[];
  filters: FilterOptions;
}
