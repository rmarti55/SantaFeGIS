"use client";

import { useEffect, useState } from "react";
import { PROBLEM_TYPES, STATUS_LABELS, FLAT_PROBLEM_TYPES } from "@/lib/arcgis";

export interface WorkOrderFilterValues {
  problemtype: string;
  problem: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

interface SubProblem {
  code: string;
  name: string;
  count: number;
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
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [subProblems, setSubProblems] = useState<SubProblem[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);

  const isFlat = FLAT_PROBLEM_TYPES.has(filters.problemtype);

  useEffect(() => {
    fetch("/api/work-orders/stats")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.byType)) {
          const counts: Record<string, number> = {};
          for (const t of data.byType) counts[t.type] = t.count;
          setTypeCounts(counts);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filters.problemtype || isFlat) {
      setSubProblems([]);
      return;
    }
    setLoadingSub(true);
    fetch(`/api/work-orders/problems?problemtype=${filters.problemtype}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSubProblems(data);
      })
      .catch(() => setSubProblems([]))
      .finally(() => setLoadingSub(false));
  }, [filters.problemtype, isFlat]);

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm z-[1000] relative">
      <div className="font-semibold text-gray-700 mr-2">Filters:</div>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500">Type</span>
        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filters.problemtype}
          onChange={(e) =>
            onChange({ ...filters, problemtype: e.target.value, problem: "" })
          }
        >
          <option value="">All Types</option>
          {Object.entries(PROBLEM_TYPES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}{typeCounts[code] != null ? ` (${typeCounts[code].toLocaleString()})` : ""}
            </option>
          ))}
        </select>
      </label>

      {!isFlat && (
        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Problem</span>
          <select
            className="border rounded px-2 py-1 text-gray-800 bg-white max-w-[220px]"
            value={filters.problem}
            disabled={!filters.problemtype || loadingSub}
            onChange={(e) => onChange({ ...filters, problem: e.target.value })}
          >
            <option value="">
              {!filters.problemtype
                ? "Select a type first"
                : loadingSub
                  ? "Loading..."
                  : "All Problems"}
            </option>
            {subProblems.map((sp) => (
              <option key={sp.code} value={sp.code}>
                {sp.name} ({sp.count.toLocaleString()})
              </option>
            ))}
          </select>
        </label>
      )}

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
