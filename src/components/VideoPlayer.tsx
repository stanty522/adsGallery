"use client";

import { getDriveEmbedUrl } from "@/lib/driveUtils";

interface VideoPlayerProps {
  fileId: string;
  onClose?: () => void;
}

export default function VideoPlayer({ fileId, onClose }: VideoPlayerProps) {
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video
        src={getDriveEmbedUrl(fileId)}
        className="w-full h-full object-contain"
        autoPlay
        controls
        playsInline
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
