"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Creative, FilterOptions, ApiResponse } from "@/lib/types";
import FilterBar from "./FilterBar";
import CreativeCard from "./CreativeCard";

const PAGE_SIZE = 30;

const EMPTY_FILTERS: FilterOptions = {
  creativeTypes: [],
  creativeFormats: [],
  platforms: [],
  metaFormats: [],
};

interface FilterState {
  search: string;
  creativeType: string;
  creativeFormat: string;
  platform: string;
  metaFormat: string;
}

const INITIAL_FILTER_STATE: FilterState = {
  search: "",
  creativeType: "",
  creativeFormat: "",
  platform: "",
  metaFormat: "",
};

export default function Gallery() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [filters, setFilters] = useState<FilterOptions>(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] =
    useState<FilterState>(INITIAL_FILTER_STATE);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch data on mount
  useEffect(() => {
    fetch("/api/creatives")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data: ApiResponse) => {
        setCreatives(data.creatives);
        setFilters(data.filters);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Filter creatives
  const filtered = useMemo(() => {
    return creatives.filter((c) => {
      if (
        activeFilters.search &&
        !c.name.toLowerCase().includes(activeFilters.search.toLowerCase())
      ) {
        return false;
      }
      if (
        activeFilters.creativeType &&
        c.creativeType !== activeFilters.creativeType
      ) {
        return false;
      }
      if (
        activeFilters.creativeFormat &&
        c.creativeFormat !== activeFilters.creativeFormat
      ) {
        return false;
      }
      if (activeFilters.platform && c.platform !== activeFilters.platform) {
        return false;
      }
      if (
        activeFilters.metaFormat &&
        c.metaFormat !== activeFilters.metaFormat
      ) {
        return false;
      }
      return true;
    });
  }, [creatives, activeFilters]);

  // Displayed subset for infinite scroll
  const displayed = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page]
  );

  const hasMore = displayed.length < filtered.length;

  // Reset page when filters change
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setActiveFilters(newFilters);
    setPage(1);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  // Loading state
  if (loading) {
    return (
      <div>
        {/* Skeleton filter bar */}
        <div className="filter-glass sticky top-0 z-40 px-4 py-3 md:px-6">
          <div className="max-w-[1800px] mx-auto">
            <div className="h-9 w-64 skeleton rounded-md mb-3" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 w-28 skeleton rounded-md" />
              ))}
            </div>
          </div>
        </div>
        {/* Skeleton grid */}
        <div className="px-4 md:px-6 py-6">
          <div className="max-w-[1800px] mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] skeleton rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-[#8a8a8d] text-sm mb-2">
            Failed to load creatives
          </p>
          <p className="text-[#5a5a5d] text-xs">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-xs text-[#d4a853] hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-4 md:px-6 pt-8 pb-4">
        <div className="max-w-[1800px] mx-auto">
          <h1
            className="text-lg font-medium tracking-tight text-[#e8e6e3]"
          >
            Ads Gallery
          </h1>
          <p className="text-xs text-[#5a5a5d] mt-1">
            Browse and filter ad creatives
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        resultCount={filtered.length}
        totalCount={creatives.length}
      />

      {/* Gallery grid */}
      <div className="px-4 md:px-6 py-6">
        <div className="max-w-[1800px] mx-auto">
          {displayed.length === 0 ? (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <p className="text-[#5a5a5d] text-sm">
                  No creatives match your filters
                </p>
                <button
                  onClick={() => handleFilterChange(INITIAL_FILTER_STATE)}
                  className="mt-3 text-xs text-[#d4a853] hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {displayed.map((creative, i) => (
                <CreativeCard key={creative.id} creative={creative} index={i} />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {/* Loading more indicator */}
          {hasMore && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-[#5a5a5d] text-xs">
                <div className="w-1 h-1 rounded-full bg-[#5a5a5d] animate-pulse" />
                <span>Loading more</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
