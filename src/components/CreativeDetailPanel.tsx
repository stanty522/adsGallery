"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Creative, CampaignMetrics } from "@/lib/types";
import { getDriveThumbnailUrl, getBestVideoId } from "@/lib/driveUtils";
import { useCreativeMetrics } from "@/hooks/useCreativeMetrics";
import VideoPlayer from "./VideoPlayer";

interface CreativeDetailPanelProps {
  creative: Creative;
  isOpen: boolean;
  onClose: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface MetricCardProps {
  value: string;
  label: string;
}

function MetricCard({ value, label }: MetricCardProps) {
  return (
    <div className="bg-[#1a1a1e] rounded-lg p-3 text-center border border-[rgba(255,255,255,0.04)]">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-xs text-[#8a8a8d] mt-1">{label}</div>
    </div>
  );
}

interface CopyBlockProps {
  label: string;
  text: string;
}

function CopyBlock({ label, text }: CopyBlockProps) {
  return (
    <div className="border-b border-[rgba(255,255,255,0.06)] last:border-b-0 py-3 first:pt-0 last:pb-0">
      <div className="text-xs text-[#8a8a8d] uppercase tracking-wide mb-1.5 font-mono">
        {label}
      </div>
      <div className="text-sm text-[#e8e6e3] leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  lead: "Lead Campaigns",
  purchase: "Purchase Campaigns",
  other: "Other Campaigns",
};

function CampaignMetricsGroup({ campaign }: { campaign: CampaignMetrics }) {
  const resultLabel = campaign.campaignType === "lead" ? "Leads" : "Purchases";
  const costLabel =
    campaign.campaignType === "lead" ? "Cost/Lead" : "Cost/Purchase";

  return (
    <div className="mb-4 last:mb-0">
      <div className="text-xs text-[#6a6a6d] mb-2 flex items-center gap-2">
        <span>{TYPE_LABELS[campaign.campaignType]}</span>
        <span className="text-[#4a4a4d]">({campaign.matchedAds} ads)</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard value={formatCurrency(campaign.spent)} label="Spent" />
        <MetricCard value={formatNumber(campaign.results)} label={resultLabel} />
        <MetricCard
          value={formatCurrency(campaign.costPerResult)}
          label={costLabel}
        />
      </div>
    </div>
  );
}

export default function CreativeDetailPanel({
  creative,
  isOpen,
  onClose,
}: CreativeDetailPanelProps) {
  const [isClosing, setIsClosing] = useState(false);
  const videoId =
    creative.metaFormat === "video" ? getBestVideoId(creative) : null;
  const imageId = creative.link45Static || creative.carouselImages[0] || null;
  const isVideo = creative.metaFormat === "video";

  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    refresh,
  } = useCreativeMetrics(creative.name, isOpen);

  const handleClose = useCallback(() => {
    setIsClosing(true);
  }, []);

  const handleAnimationEnd = useCallback(() => {
    if (isClosing) {
      setIsClosing(false);
      onClose();
    }
  }, [isClosing, onClose]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    },
    [handleClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const hasAdCopy =
    creative.adCopy?.headline ||
    creative.adCopy?.primaryText ||
    creative.adCopy?.description ||
    (isVideo && creative.adCopy?.script);

  return createPortal(
    <div
      className={`fixed inset-0 flex justify-end ${isClosing ? "animate-[fadeOut_0.25s_ease-in_forwards]" : "animate-[fadeIn_0.2s_ease-out]"}`}
      style={{ zIndex: 99999 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
      />

      {/* Panel */}
      <div
        className={`relative w-full max-w-md bg-[#0e0e10] border-l border-[rgba(255,255,255,0.08)] h-full overflow-hidden flex flex-col ${isClosing ? "panel-slide-out" : "panel-slide-in"}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={handleAnimationEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.06)]">
          <h2 className="text-sm font-medium text-white truncate pr-4">
            {creative.name}
          </h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Media Section */}
          <div className="p-4">
            <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-[#141416]">
              {isVideo && videoId ? (
                <VideoPlayer fileId={videoId} />
              ) : imageId ? (
                <img
                  src={getDriveThumbnailUrl(imageId)}
                  alt={creative.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-[#2a2a2d]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-[#8a8a8d] uppercase tracking-wider font-mono">
                Performance
              </h3>
              <button
                onClick={refresh}
                disabled={metricsLoading}
                className="p-1.5 text-[#6a6a6d] hover:text-white transition-colors disabled:opacity-50 rounded"
                title="Refresh metrics"
              >
                <svg
                  className={`w-3.5 h-3.5 ${metricsLoading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>

            {metricsLoading && !metrics ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-16 skeleton rounded-lg" />
                ))}
              </div>
            ) : metricsError ? (
              <div className="text-center py-4 text-[#6a6a6d] text-xs">
                Failed to load metrics
              </div>
            ) : metrics && metrics.campaigns.length > 0 ? (
              <>
                {/* Total spend summary */}
                <div className="bg-[#1a1a1e] rounded-lg p-3 text-center border border-[rgba(255,255,255,0.04)] mb-4">
                  <div className="text-xl font-semibold text-white">
                    {formatCurrency(metrics.totalSpent)}
                  </div>
                  <div className="text-xs text-[#8a8a8d] mt-1">Total Spent</div>
                </div>

                {/* Grouped by campaign type */}
                {metrics.campaigns.map((campaign, i) => (
                  <CampaignMetricsGroup key={i} campaign={campaign} />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-[#6a6a6d] text-xs">
                No ad data found for this creative
              </div>
            )}
          </div>

          {/* Ad Copy Section */}
          <div className="px-4 pb-6">
            <h3 className="text-xs text-[#8a8a8d] uppercase tracking-wider font-mono mb-3">
              Ad Copy
            </h3>
            <div className="bg-[#141416] rounded-lg p-4 border border-[rgba(255,255,255,0.04)]">
              {hasAdCopy ? (
                <>
                  {creative.adCopy?.headline && (
                    <CopyBlock label="Headline" text={creative.adCopy.headline} />
                  )}
                  {creative.adCopy?.primaryText && (
                    <CopyBlock
                      label="Primary Text"
                      text={creative.adCopy.primaryText}
                    />
                  )}
                  {creative.adCopy?.description && (
                    <CopyBlock
                      label="Description"
                      text={creative.adCopy.description}
                    />
                  )}
                  {isVideo && creative.adCopy?.script && (
                    <CopyBlock label="Script" text={creative.adCopy.script} />
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-[#6a6a6d] text-xs">
                  No copy data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
