"use client";

import { getDriveEmbedUrl, getVideoPosterUrl } from "@/lib/driveUtils";

interface VideoPlayerProps {
  fileId: string;
  onClose?: () => void;
}

export default function VideoPlayer({ fileId, onClose }: VideoPlayerProps) {
  // Show a poster frame immediately so the panel isn't blank while the (large,
  // non-faststart) mp4 buffers. The poster comes from Google Drive's thumbnail
  // endpoint for Drive-hosted videos; fal.ai videos have none (null → no poster).
  const poster = getVideoPosterUrl(fileId, 720) ?? undefined;
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video
        src={getDriveEmbedUrl(fileId)}
        poster={poster}
        className="w-full h-full object-contain"
        autoPlay
        controls
        playsInline
        preload="auto"
      />
      {onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors z-10"
          aria-label="Close video"
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
      )}
    </div>
  );
}
