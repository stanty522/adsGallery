"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { FilterOptions } from "@/lib/types";

interface FilterState {
  search: string;
  creativeType: string;
  creativeFormat: string;
  platform: string;
  metaFormat: string;
  adStatus: string;
}

interface FilterBarProps {
  filters: FilterOptions;
  activeFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  resultCount: number;
  totalCount: number;
}

export default function FilterBar({
  filters,
  activeFilters,
  onFilterChange,
  resultCount,
  totalCount,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(activeFilters.search);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFilterChange({ ...activeFilters, search: value });
      }, 300);
    },
    [activeFilters, onFilterChange]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelectChange = (key: keyof FilterState, value: string) => {
    onFilterChange({ ...activeFilters, [key]: value });
  };

  const hasActiveFilters =
    activeFilters.search ||
    activeFilters.creativeType ||
    activeFilters.creativeFormat ||
    activeFilters.platform ||
    activeFilters.metaFormat ||
    activeFilters.adStatus;

  const clearAll = () => {
    setLocalSearch("");
    onFilterChange({
      search: "",
      creativeType: "",
      creativeFormat: "",
      platform: "",
      metaFormat: "",
      adStatus: "",
    });
  };

  const selectClass =
    "bg-[#1a1a1e] border border-[rgba(255,255,255,0.08)] rounded-md px-3 py-2 text-sm text-[#e8e6e3] focus:border-[#d4a853] focus:ring-0 transition-colors cursor-pointer hover:border-[rgba(255,255,255,0.15)] min-w-0";

  return (
    <div className="filter-glass sticky top-0 z-40 px-4 py-3 md:px-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Top row: search + count */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a5d]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search creatives..."
              className="w-full bg-[#1a1a1e] border border-[rgba(255,255,255,0.08)] rounded-md pl-10 pr-4 py-2 text-sm text-[#e8e6e3] placeholder-[#5a5a5d] focus:border-[#d4a853] focus:ring-0 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span
              className="text-xs text-[#5a5a5d] tabular-nums"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {resultCount}
              <span className="text-[#3a3a3d]"> / {totalCount}</span>
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="text-xs text-[#8a8a8d] hover:text-[#d4a853] transition-colors px-2 py-1 rounded hover:bg-[rgba(212,168,83,0.08)]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2">
          <select
            value={activeFilters.creativeType}
            onChange={(e) => handleSelectChange("creativeType", e.target.value)}
            className={selectClass}
          >
            <option value="">All Types</option>
            {filters.creativeTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={activeFilters.creativeFormat}
            onChange={(e) =>
              handleSelectChange("creativeFormat", e.target.value)
            }
            className={selectClass}
          >
            <option value="">All Formats</option>
            {filters.creativeFormats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            value={activeFilters.platform}
            onChange={(e) => handleSelectChange("platform", e.target.value)}
            className={selectClass}
          >
            <option value="">All Platforms</option>
            {filters.platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={activeFilters.metaFormat}
            onChange={(e) => handleSelectChange("metaFormat", e.target.value)}
            className={selectClass}
          >
            <option value="">All Media</option>
            {filters.metaFormats.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={activeFilters.adStatus}
            onChange={(e) => handleSelectChange("adStatus", e.target.value)}
            className={selectClass}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="NOT_ON_META">Not on Meta</option>
          </select>
        </div>
      </div>
    </div>
  );
}
