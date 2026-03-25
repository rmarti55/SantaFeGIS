"use client";

import { ZONING_CATEGORY_LIST } from "@/lib/arcgis";
import type { ZoningFilterValues } from "./ZoningMap";

interface Props {
  filters: ZoningFilterValues;
  onChange: (filters: ZoningFilterValues) => void;
  onRefresh: () => void;
  loading: boolean;
  count: number;
}

export default function ZoningFilters({
  filters,
  onChange,
  onRefresh,
  loading,
  count,
}: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm z-[1000] relative">
      <div className="font-semibold text-gray-700 mr-2">Filters:</div>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500">Category</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.category}
          onChange={(e) =>
            onChange({ ...filters, category: e.target.value })
          }
        >
          <option value="">All Categories</option>
          {ZONING_CATEGORY_LIST.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500">View</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.viewMode}
          onChange={(e) =>
            onChange({
              ...filters,
              viewMode: e.target.value as "simplified" | "detailed",
            })
          }
        >
          <option value="simplified">Simplified</option>
          <option value="detailed">Detailed</option>
        </select>
      </label>

      <button
        onClick={onRefresh}
        className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition-colors"
      >
        Refresh
      </button>

      <div className="ml-auto flex items-center gap-3 text-gray-500">
        {loading && <span className="animate-pulse">Loading...</span>}
        {!loading && (
          <span>
            {count.toLocaleString()} zone{count !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
