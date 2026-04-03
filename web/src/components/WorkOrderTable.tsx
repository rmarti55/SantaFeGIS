"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PROBLEM_TYPES,
  PROBLEM_TYPE_COLORS,
  STATUS_LABELS,
} from "@/lib/arcgis";

interface Row {
  objectid: number;
  problemtype: string;
  problemtype_original: string;
  problemtype_label: string;
  problem: string | null;
  status: string;
  status_label: string;
  created: number;
  resolved: number | null;
  days_to_resolve: number | null;
}

interface TableResponse {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type SortKey =
  | "CreationDate"
  | "problemtype"
  | "Problem"
  | "status"
  | "time_to_resolve"
  | "resolved_on";

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "closed":
    case "cs_only_resolved":
      return "text-green-700 bg-green-50";
    case "In progress":
      return "text-blue-700 bg-blue-50";
    case "Submitted":
      return "text-amber-700 bg-amber-50";
    case "Received":
      return "text-purple-700 bg-purple-50";
    default:
      return "text-gray-700 bg-gray-50";
  }
}

export default function WorkOrderTable() {
  const [data, setData] = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>("CreationDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "50",
      sortBy,
      sortDir,
    });
    if (search) params.set("search", search);
    if (filterType) params.set("problemtype", filterType);
    if (filterStatus) params.set("status", filterStatus);

    try {
      const resp = await fetch(`/api/work-orders/table?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const json = await resp.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, search, filterType, filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "CreationDate" ? "desc" : "asc");
    }
    setPage(1);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const SortHeader = ({
    label,
    sortKey,
    className,
  }: {
    label: string;
    sortKey: SortKey;
    className?: string;
  }) => (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => handleSort(sortKey)}
    >
      {label}
      {sortBy === sortKey && (
        <span className="ml-1">
          {sortDir === "asc" ? "\u25B2" : "\u25BC"}
        </span>
      )}
    </th>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Search problems (e.g. sidewalk, pothole)..."
            className="border rounded px-2 py-1 w-72 text-gray-800 bg-white"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>

        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Types</option>
          {Object.entries(PROBLEM_TYPES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-3 text-gray-500">
          {loading && <span className="animate-pulse">Loading...</span>}
          {data && !loading && (
            <span>{data.total.toLocaleString()} work orders</span>
          )}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full bg-white">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                WO #
              </th>
              <SortHeader label="Category" sortKey="problemtype" />
              <SortHeader label="Problem" sortKey="Problem" />
              <SortHeader label="Status" sortKey="status" />
              <SortHeader label="Submitted" sortKey="CreationDate" />
              <SortHeader label="Resolved" sortKey="resolved_on" />
              <SortHeader
                label="Days"
                sortKey="time_to_resolve"
                className="text-right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.rows.map((row) => (
              <tr
                key={row.objectid}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-3 py-2.5 text-sm text-gray-500 font-mono text-xs">
                  {row.objectid}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold"
                    style={{
                      backgroundColor:
                        (PROBLEM_TYPE_COLORS[row.problemtype] ?? "#94a3b8") +
                        "18",
                      color:
                        PROBLEM_TYPE_COLORS[row.problemtype] ?? "#64748b",
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          PROBLEM_TYPE_COLORS[row.problemtype] ?? "#94a3b8",
                      }}
                    />
                    {row.problemtype_label}
                  </span>
                  {row.problemtype !== row.problemtype_original && (
                    <div
                      className="text-[10px] text-gray-400 mt-0.5 pl-1"
                      title={`Originally filed under: ${PROBLEM_TYPES[row.problemtype_original] ?? row.problemtype_original}`}
                    >
                      was: {PROBLEM_TYPES[row.problemtype_original] ?? row.problemtype_original}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-800 max-w-xs">
                  <div className="truncate" title={row.problem ?? undefined}>
                    {row.problem || "—"}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusBadgeClass(row.status)}`}
                  >
                    {row.status_label}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                  {formatDate(row.created)}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                  {formatDate(row.resolved)}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-500 text-right tabular-nums">
                  {row.days_to_resolve != null ? row.days_to_resolve : "—"}
                </td>
              </tr>
            ))}
            {data?.rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-gray-400"
                >
                  No results found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
          <div className="text-gray-500">
            Page {data.page} of {data.totalPages} (
            {data.total.toLocaleString()} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setPage((p) => Math.min(data.totalPages, p + 1))
              }
              disabled={page >= data.totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
