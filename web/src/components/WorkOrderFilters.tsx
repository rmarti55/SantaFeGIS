"use client";

import { PROBLEM_TYPES, STATUS_LABELS } from "@/lib/arcgis";

export interface WorkOrderFilterValues {
  problemtype: string;
  status: string;
  dateFrom: string;
  dateTo: string;
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
        <span className="text-gray-500">Type</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.problemtype}
          onChange={(e) =>
            onChange({ ...filters, problemtype: e.target.value })
          }
        >
          <option value="">All Types</option>
          {Object.entries(PROBLEM_TYPES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>

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
        <span className="text-gray-500">From</span>
        <input
          type="date"
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        />
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500">To</span>
        <input
          type="date"
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        />
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
