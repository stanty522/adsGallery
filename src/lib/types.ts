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
}

export interface FilterOptions {
  creativeTypes: string[];
  creativeFormats: string[];
  platforms: string[];
  metaFormats: string[];
}

export interface ApiResponse {
  creatives: Creative[];
  filters: FilterOptions;
}
