"use client";

import { PROJECT_TYPES, PROJECT_PHASES } from "@/lib/arcgis";
import type { CapitalProjectFilterValues } from "./CapitalProjectsMap";

interface Props {
  filters: CapitalProjectFilterValues;
  onChange: (filters: CapitalProjectFilterValues) => void;
  onRefresh: () => void;
  loading: boolean;
  count: number;
}

export default function CapitalProjectsFilters({
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
        <span className="text-gray-500">Type</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.projtype}
          onChange={(e) =>
            onChange({ ...filters, projtype: e.target.value })
          }
        >
          <option value="">All Types</option>
          {Object.entries(PROJECT_TYPES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500">Phase</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.projphase}
          onChange={(e) =>
            onChange({ ...filters, projphase: e.target.value })
          }
        >
          <option value="">All Phases</option>
          {Object.entries(PROJECT_PHASES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
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
            {count.toLocaleString()} project{count !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
