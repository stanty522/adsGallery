"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Creative } from "@/lib/types";
import {
  getDriveThumbnailUrl,
  getVideoPosterUrl,
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const videoId =
    creative.metaFormat === "video" ? getBestVideoId(creative) : null;

  // Poster source for the card. Prefer a real static image (served fast from
  // the R2 CDN), otherwise pull a single poster frame for Drive-hosted videos.
  // fal.ai videos are full URLs with no still-frame source, so posterUrl is
  // null for them and we fall back to a viewport-gated <video> below.
  const staticImageRef =
    creative.link45Static ||
    (videoId ? null : creative.carouselImages[0] || null);
  const posterUrl = staticImageRef
    ? getDriveThumbnailUrl(staticImageRef)
    : getVideoPosterUrl(videoId);

  // Only the fal.ai-hosted videos (no poster frame available) need a real
  // <video> to show a thumbnail. Mount it solely while the card is near the
  // viewport so at most a handful exist at once — mounting all ~785 is what
  // made the gallery a memory hog. content-visibility doesn't gate media
  // loading, so we gate it ourselves with an observer.
  const needsVideoFallback = !posterUrl && !!videoId;
  useEffect(() => {
    if (!needsVideoFallback) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [needsVideoFallback]);

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
      ref={cardRef}
      className="card-reveal card-cv group relative cursor-pointer"
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
      <div
        className={`relative aspect-[9/16] rounded-lg overflow-hidden bg-[#141416] border transition-all duration-300 ${
          creative.isWinner
            ? "border-green-500/50 ring-2 ring-green-500/60"
            : "border-[rgba(255,255,255,0.04)] group-hover:border-[rgba(255,255,255,0.1)]"
        }`}
      >
        {/* Thumbnail - always a poster image, never a <video> element */}
        {posterUrl && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 skeleton" />
            )}
            <img
              src={posterUrl}
              alt={creative.name}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03] ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        ) : needsVideoFallback && inView && !imgError ? (
          /* fal.ai video with no poster frame: render a muted, metadata-only
             <video> just while near the viewport to show a thumbnail. */
          <>
            {!imgLoaded && <div className="absolute inset-0 skeleton" />}
            <video
              src={getDriveEmbedUrl(videoId!)}
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

        {/* Winner badge - bottom right (lead CPL ≤ $5 / purchase CPP ≤ $150) */}
        {creative.isWinner && (
          <div className="absolute bottom-2 right-2 pointer-events-none">
            <span className="badge bg-green-500 text-black font-semibold flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.342 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.287-3.957z" />
              </svg>
              {creative.costPerResult != null
                ? `$${creative.costPerResult.toFixed(0)} ${
                    creative.campaignType === "purchase" ? "CPP" : "CPL"
                  }`
                : "Winner"}
            </span>
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
