"use client";

import { ROAD_CONDITIONS } from "@/lib/arcgis";

export interface RoadConditionFilterValues {
  condition: string;
  decade: string;
  colorBy: "age" | "condition";
  showPriority: boolean;
}

interface Props {
  filters: RoadConditionFilterValues;
  onChange: (filters: RoadConditionFilterValues) => void;
  onRefresh: () => void;
  loading: boolean;
  count: number;
}

export default function RoadConditionFilters({
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
        <span className="text-gray-500">Condition</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.condition}
          onChange={(e) =>
            onChange({ ...filters, condition: e.target.value })
          }
        >
          <option value="">All Conditions</option>
          {Object.entries(ROAD_CONDITIONS)
            .filter(([code]) => code !== " ")
            .map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500">Repaved</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.decade}
          onChange={(e) =>
            onChange({ ...filters, decade: e.target.value })
          }
        >
          <option value="">All Decades</option>
          <option value="2010">2010s</option>
          <option value="2000">2000s</option>
          <option value="1990">1990s</option>
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500">Color by</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.colorBy}
          onChange={(e) =>
            onChange({
              ...filters,
              colorBy: e.target.value as "age" | "condition",
            })
          }
        >
          <option value="age">Repave Age</option>
          <option value="condition">Condition Rating</option>
        </select>
      </label>

      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          className="rounded"
          checked={filters.showPriority}
          onChange={(e) =>
            onChange({ ...filters, showPriority: e.target.checked })
          }
        />
        <span className="text-gray-500">Show Priority Roads</span>
      </label>

      <button
        onClick={onRefresh}
        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
      >
        Refresh
      </button>

      <div className="ml-auto flex items-center gap-3 text-gray-500">
        {loading && <span className="animate-pulse">Loading...</span>}
        {!loading && <span>{count.toLocaleString()} city road segments</span>}
      </div>
    </div>
  );
}
