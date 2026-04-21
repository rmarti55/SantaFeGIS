"use client";

import { useEffect, useState } from "react";
import { STATUS_LABELS } from "@/lib/arcgis";
import type { WorkOrderFilterValues } from "./WorkOrderFilters";

interface Props {
  filters: WorkOrderFilterValues;
  onChange: (f: WorkOrderFilterValues) => void;
  onRefresh: () => void;
  loading: boolean;
  count: number;
}

interface ProblemItem {
  problem: string;
  count: number;
}

const DATE_RANGES = {
  "7d": { label: "Last week", days: 7 },
  "14d": { label: "Last 2 weeks", days: 14 },
  "30d": { label: "Last 30 days", days: 30 },
  "60d": { label: "Last 2 months", days: 60 },
  "90d": { label: "Last 3 months", days: 90 },
  "180d": { label: "Last 6 months", days: 180 },
  "365d": { label: "Last year", days: 365 },
  "730d": { label: "Last 2 years", days: 730 },
} as const;

export default function WorkOrderSidebar({
  filters,
  onChange,
  onRefresh,
  loading,
  count,
}: Props) {
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const resp = await fetch("/api/work-orders/stats");
        if (!resp.ok) throw new Error("Failed to load stats");
        const data = await resp.json();
        setProblems(data.byProblem || []);
      } catch (err) {
        console.error("Error loading problems:", err);
        setProblems([]);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  const displayedProblems = showAll ? problems : problems.slice(0, 30);
  const hiddenCount = Math.max(0, problems.length - 30);

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header Section */}
      <div className="p-4 border-b border-gray-100 space-y-3 flex-shrink-0">
        <div className="text-sm font-semibold text-gray-700">Filters</div>

        {/* Status */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Status</label>
          <select
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Date Range</label>
          <select
            value={filters.dateRange}
            onChange={(e) =>
              onChange({
                ...filters,
                dateRange: e.target.value as WorkOrderFilterValues["dateRange"],
              })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="730d">Last 2 years</option>
            <option value="365d">Last year</option>
            <option value="180d">Last 6 months</option>
            <option value="90d">Last 3 months</option>
            <option value="60d">Last 2 months</option>
            <option value="30d">Last 30 days</option>
            <option value="14d">Last 2 weeks</option>
            <option value="7d">Last week</option>
          </select>
        </div>

        {/* Refresh & Count */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Refresh
          </button>
          <span className="text-xs font-medium text-gray-600">
            {loading ? "Loading..." : `${count} orders`}
          </span>
        </div>
      </div>

      {/* Problems List - Scrollable Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loadingStats ? (
          <div className="p-4 space-y-2">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="h-6 bg-gray-200 rounded animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
            {/* Problem list */}
            <div className="space-y-0">
              {displayedProblems.map((item) => {
                const isSelected = filters.problem === item.problem;
                return (
                  <div
                    key={item.problem}
                    onClick={() =>
                      onChange({ ...filters, problem: item.problem })
                    }
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-100 text-blue-900"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4"
                    />
                    <span className="flex-1 truncate text-xs">
                      {item.problem}
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Show More Button */}
            {hiddenCount > 0 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full mt-2 px-3 py-2 text-xs text-blue-600 font-medium hover:bg-blue-50 rounded transition-colors"
              >
                + Show {hiddenCount} more problems
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
