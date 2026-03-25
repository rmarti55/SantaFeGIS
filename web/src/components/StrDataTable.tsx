"use client";

import { useEffect, useState, useCallback } from "react";

interface Row {
  id: number;
  source: string;
  address: string | null;
  match_addr: string | null;
  business_license: string | null;
  business_name: string | null;
  dba: string | null;
  status: string | null;
  license_type: string | null;
  rental_type: string | null;
  zoning: string | null;
  issue_date: string | null;
  expiration_date: string | null;
}

interface TableResponse {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function rentalTypeBadge(type: string | null): string {
  if (!type) return "text-gray-500 bg-gray-50";
  if (type.startsWith("Residential")) return "text-blue-600 bg-blue-50";
  if (type === "Non-Residential") return "text-purple-600 bg-purple-50";
  if (type.includes("Accessory")) return "text-teal-600 bg-teal-50";
  return "text-gray-600 bg-gray-50";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

type SortKey =
  | "address"
  | "business_name"
  | "business_license"
  | "rental_type"
  | "zoning"
  | "status"
  | "issue_date"
  | "expiration_date";

export default function StrDataTable() {
  const [data, setData] = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>("address");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

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

    try {
      const resp = await fetch(`/api/str-table?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const json = await resp.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
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
  }: {
    label: string;
    sortKey: SortKey;
  }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
      onClick={() => handleSort(sortKey)}
    >
      {label}
      {sortBy === sortKey && (
        <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
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
            placeholder="Search address, name, or license..."
            className="border rounded px-2 py-1 w-60 text-gray-800 bg-white"
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

        <div className="ml-auto flex items-center gap-3 text-gray-500">
          {loading && <span className="animate-pulse">Loading...</span>}
          {data && !loading && (
            <span>{data.total.toLocaleString()} rentals</span>
          )}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full bg-white">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <SortHeader label="Address" sortKey="address" />
              <SortHeader label="Business Name" sortKey="business_name" />
              <SortHeader label="License" sortKey="business_license" />
              <SortHeader label="Rental Type" sortKey="rental_type" />
              <SortHeader label="Zoning" sortKey="zoning" />
              <SortHeader label="Status" sortKey="status" />
              <SortHeader label="Issued" sortKey="issue_date" />
              <SortHeader label="Expires" sortKey="expiration_date" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-3 py-2.5 text-sm text-gray-800">
                  <div className="font-medium">
                    {row.address || "No address"}
                  </div>
                  {row.match_addr &&
                    row.match_addr !== row.address && (
                      <div className="text-xs text-gray-400">
                        {row.match_addr}
                      </div>
                    )}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-800">
                  <div>{row.business_name || "—"}</div>
                  {row.dba && row.dba.trim() && (
                    <div className="text-xs text-gray-400">
                      DBA: {row.dba}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 font-mono text-xs">
                  {row.business_license || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${rentalTypeBadge(row.rental_type)}`}
                  >
                    {row.rental_type || "Unknown"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600">
                  {row.zoning || "—"}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600">
                  {row.status || "—"}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                  {formatDate(row.issue_date)}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                  {formatDate(row.expiration_date)}
                </td>
              </tr>
            ))}
            {data?.rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
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
