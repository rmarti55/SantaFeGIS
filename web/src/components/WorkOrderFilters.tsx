"use client";

import { STATUS_LABELS } from "@/lib/arcgis";

export interface WorkOrderFilterValues {
  status: string;
  dateRange: "7d" | "14d" | "30d" | "60d" | "90d" | "180d" | "365d" | "730d";
  problem: string;
}

interface Props {
  filters: WorkOrderFilterValues;
  onChange: (filters: WorkOrderFilterValues) => void;
  onRefresh: () => void;
  loading: boolean;
  count: number;
}

export default function WorkOrderFilters({
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
        <span className="text-gray-500">Status</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500">Date Range</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.dateRange}
          onChange={(e) =>
            onChange({
              ...filters,
              dateRange: e.target.value as WorkOrderFilterValues["dateRange"],
            })
          }
        >
          <option value="7d">Last week</option>
          <option value="14d">Last 2 weeks</option>
          <option value="30d">Last 30 days</option>
          <option value="60d">Last 2 months</option>
          <option value="90d">Last 3 months</option>
          <option value="180d">Last 6 months</option>
          <option value="365d">Last year</option>
          <option value="730d">Last 2 years</option>
        </select>
      </label>

      <button
        onClick={onRefresh}
        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
      >
        Refresh
      </button>

      <div className="ml-auto flex items-center gap-3 text-gray-500">
        {loading && <span className="animate-pulse">Loading...</span>}
        {!loading && <span>{count.toLocaleString()} work orders</span>}
      </div>
    </div>
  );
}
