"use client";

import { useState, useCallback } from "react";
import { Creative } from "@/lib/types";
import {
  getDriveThumbnailUrl,
  getDriveEmbedUrl,
  getBestVideoId,
} from "@/lib/driveUtils";
import CreativeDetailPanel from "./CreativeDetailPanel";

interface CreativeCardProps {
  creative: Creative;
  index: number;
}

export default function CreativeCard({ creative, index }: CreativeCardProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // For videos, use link45Static as thumbnail; for images/carousels, use available images
  const staticThumbId = creative.link45Static;
  const videoId =
    creative.metaFormat === "video" ? getBestVideoId(creative) : null;
  // For non-videos, use the first available image
  const imageThumbId = !videoId
    ? creative.link45Static || creative.carouselImages[0] || null
    : null;

  const handleClick = useCallback(() => {
    setShowDetailPanel(true);
  }, []);

  const formatBadgeClass =
    creative.metaFormat === "video"
      ? "badge-video"
      : creative.metaFormat === "carousel"
        ? "badge-carousel"
        : "badge-image";

  // Stagger animation delay based on position within the current "page" of 30
  const staggerDelay = (index % 30) * 0.03;

  return (
    <div
      className="card-reveal group relative cursor-pointer"
      style={{ animationDelay: `${staggerDelay}s` }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Card container - fixed 9:16 aspect ratio */}
      <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-[#141416] border border-[rgba(255,255,255,0.04)] group-hover:border-[rgba(255,255,255,0.1)] transition-all duration-300">
        {/* Thumbnail - use static image if available, otherwise video element for videos */}
        {staticThumbId && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 skeleton" />
            )}
            <img
              src={getDriveThumbnailUrl(staticThumbId)}
              alt={creative.name}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03] ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        ) : imageThumbId && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 skeleton" />
            )}
            <img
              src={getDriveThumbnailUrl(imageThumbId)}
              alt={creative.name}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03] ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        ) : videoId && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 skeleton" />
            )}
            <video
              src={getDriveEmbedUrl(videoId)}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03] ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
              muted
              playsInline
              preload="metadata"
              onLoadedData={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        ) : (
          /* Placeholder for missing/errored images */
          <div className="w-full h-full flex items-center justify-center bg-[#141416]">
            <svg
              className="w-8 h-8 text-[#2a2a2d]"
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

        {/* Play icon overlay for videos */}
        {videoId && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <svg
                className="w-5 h-5 text-white ml-0.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Name overlay on hover */}
        <div className="absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <p className="text-xs text-white/90 leading-snug line-clamp-2">
            {creative.name}
          </p>
        </div>

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none">
          <div className="flex gap-1 flex-wrap items-center">
            <span className="badge badge-type">{creative.creativeType}</span>
            <span className="badge badge-platform">{creative.platform}</span>
          </div>
          <span className={`badge ${formatBadgeClass}`}>
            {creative.metaFormat}
          </span>
        </div>

        {/* Meta Ad Status badge - bottom left */}
        {creative.metaAdStatus && (
          <div className="absolute bottom-2 left-2 pointer-events-none">
            {creative.metaAdStatus === "ACTIVE" ? (
              <span className="badge bg-green-600 text-white font-medium">
                Active
              </span>
            ) : (
              <span className="badge bg-gray-600 text-white font-medium">
                Inactive
              </span>
            )}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <CreativeDetailPanel
        creative={creative}
        isOpen={showDetailPanel}
        onClose={() => setShowDetailPanel(false)}
      />
    </div>
  );
}
