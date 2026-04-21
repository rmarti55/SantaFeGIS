"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";

interface Contract {
  id: number;
  contract_number: string;
  item: string | null;
  start_date: string | null;
  department: string | null;
  vendor: string | null;
  purpose: string | null;
  amount: number;
  amount_cents: number;
  pdf_url: string | null;
}

interface TableResponse {
  rows: Contract[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Stats {
  total: number;
  totalSpend: number;
  vendorCount: number;
  deptCount: number;
  byDepartment: { department: string; count: number; totalSpend: number }[];
  byYear: { year: number; count: number; totalSpend: number }[];
  topVendors: { vendor: string; count: number; totalSpend: number }[];
}

type SortKey = "start_date" | "amount" | "vendor" | "department" | "contract_number" | "item";

const PAGE_SIZE = 50;

function fmt$(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFull$(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(raw: string | null): string {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return raw;
  }
}

export default function ContractsTable() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>("start_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterYearFrom, setFilterYearFrom] = useState("");
  const [filterYearTo, setFilterYearTo] = useState("");

  const [view, setView] = useState<"table" | "stats">("table");

  const fetchTable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        sortDir,
        ...(search ? { search } : {}),
        ...(filterDept ? { department: filterDept } : {}),
        ...(filterYearFrom ? { yearFrom: filterYearFrom } : {}),
        ...(filterYearTo ? { yearTo: filterYearTo } : {}),
      });
      const r = await fetch(`/api/contracts/table?${params}`);
      if (!r.ok) throw new Error(`API error: ${r.status}`);
      const data: TableResponse = await r.json();
      setRows(data.rows);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, search, filterDept, filterYearFrom, filterYearTo]);

  const statsLoaded = useRef(false);
  useEffect(() => {
    if (statsLoaded.current) return;
    statsLoaded.current = true;
    fetch("/api/contracts/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    fetchTable();
  }, [fetchTable]);

  const departments = useMemo(() => {
    if (!stats) return [];
    return stats.byDepartment.map((d) => d.department).sort();
  }, [stats]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "amount" || key === "start_date" ? "desc" : "asc");
    }
    setPage(1);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const SortHeader = ({ label, sortKey, className }: { label: string; sortKey: SortKey; className?: string }) => (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => handleSort(sortKey)}
    >
      {label}
      {sortBy === sortKey && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header + KPIs */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        {statsLoading ? (
          <div className="text-gray-400 text-sm">Loading stats...</div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Contracts</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total.toLocaleString()}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <div className="text-xs text-green-700 uppercase tracking-wide">Total Spend</div>
                <div className="text-2xl font-bold text-green-800 mt-1">{fmt$(stats.totalSpend)}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="text-xs text-blue-700 uppercase tracking-wide">Unique Vendors</div>
                <div className="text-2xl font-bold text-blue-800 mt-1">{stats.vendorCount.toLocaleString()}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <div className="text-xs text-purple-700 uppercase tracking-wide">Departments</div>
                <div className="text-2xl font-bold text-purple-800 mt-1">{stats.deptCount}</div>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setView("table")}
                className={`px-3 py-1 text-sm rounded ${view === "table" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Table
              </button>
              <button
                onClick={() => setView("stats")}
                className={`px-3 py-1 text-sm rounded ${view === "stats" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Breakdown
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* Stats view */}
      {view === "stats" && stats && (
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Spend by Year */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Spend by Year</h3>
            <div className="space-y-2">
              {stats.byYear.map((row) => {
                const maxSpend = Math.max(...stats.byYear.map((r) => r.totalSpend));
                return (
                  <div key={row.year} className="flex items-center gap-3 text-sm">
                    <span className="w-12 text-gray-500 tabular-nums">{row.year}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${(row.totalSpend / maxSpend) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-right tabular-nums text-gray-700 font-medium">{fmt$(row.totalSpend)}</span>
                    <span className="w-16 text-right tabular-nums text-gray-400 text-xs">{row.count} contracts</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Vendors */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Top 20 Vendors by Total Spend</h3>
            <div className="space-y-1.5">
              {stats.topVendors.map((row, i) => {
                const maxSpend = stats.topVendors[0]?.totalSpend ?? 1;
                return (
                  <div key={row.vendor} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                    <span className="flex-1 text-gray-700 truncate" title={row.vendor}>{row.vendor}</span>
                    <div className="w-32 bg-gray-100 rounded-full h-3 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(row.totalSpend / maxSpend) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-right tabular-nums text-gray-700 font-medium text-xs">{fmt$(row.totalSpend)}</span>
                    <span className="w-12 text-right tabular-nums text-gray-400 text-xs">{row.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Department */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Spend by Department</h3>
            <div className="space-y-1.5">
              {stats.byDepartment.map((row, i) => {
                const maxSpend = stats.byDepartment[0]?.totalSpend ?? 1;
                return (
                  <div key={row.department} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                    <button
                      className="flex-1 text-left text-blue-600 hover:underline truncate"
                      title={row.department}
                      onClick={() => {
                        setFilterDept(row.department);
                        setPage(1);
                        setView("table");
                      }}
                    >
                      {row.department}
                    </button>
                    <div className="w-32 bg-gray-100 rounded-full h-3 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{ width: `${(row.totalSpend / maxSpend) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-right tabular-nums text-gray-700 font-medium text-xs">{fmt$(row.totalSpend)}</span>
                    <span className="w-12 text-right tabular-nums text-gray-400 text-xs">{row.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Table view */}
      {view === "table" && (
        <>
          {/* Filter bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Search vendor, purpose, item..."
                className="border rounded px-2 py-1 w-72 text-gray-800 bg-white"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Search
              </button>
              {search && (
                <button
                  onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
                  className="text-gray-400 hover:text-gray-600 px-2"
                >
                  Clear
                </button>
              )}
            </div>

            <select
              className="border rounded px-2 py-1 text-gray-800 bg-white"
              value={filterDept}
              onChange={(e) => { setFilterDept(e.target.value); setPage(1); }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Year from"
                className="border rounded px-2 py-1 w-24 text-gray-800 bg-white"
                value={filterYearFrom}
                onChange={(e) => { setFilterYearFrom(e.target.value); setPage(1); }}
              />
              <span className="text-gray-400">–</span>
              <input
                type="number"
                placeholder="Year to"
                className="border rounded px-2 py-1 w-24 text-gray-800 bg-white"
                value={filterYearTo}
                onChange={(e) => { setFilterYearTo(e.target.value); setPage(1); }}
              />
            </div>

            {(filterDept || filterYearFrom || filterYearTo) && (
              <button
                onClick={() => { setFilterDept(""); setFilterYearFrom(""); setFilterYearTo(""); setPage(1); }}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Clear filters
              </button>
            )}

            <div className="ml-auto text-gray-500">
              {loading ? "Loading..." : `${total.toLocaleString()} contracts`}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {error ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                  <p className="font-medium">Failed to load contracts</p>
                  <p className="text-sm mt-1">{error}</p>
                  <button onClick={fetchTable} className="mt-3 px-4 py-1.5 bg-blue-600 text-white rounded text-sm">Retry</button>
                </div>
              </div>
            ) : (
              <table className="w-full bg-white text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <SortHeader label="Contract #" sortKey="contract_number" />
                    <SortHeader label="Start Date" sortKey="start_date" />
                    <SortHeader label="Department" sortKey="department" />
                    <SortHeader label="Vendor" sortKey="vendor" />
                    <SortHeader label="Item" sortKey="item" />
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Purpose</th>
                    <SortHeader label="Amount" sortKey="amount" className="text-right" />
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-2" />
                        Loading...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-gray-400">No contracts found</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{row.contract_number}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap tabular-nums text-xs">{fmtDate(row.start_date)}</td>
                        <td className="px-3 py-2.5 text-gray-700 max-w-[160px]">
                          <button
                            className="text-left hover:text-blue-600 hover:underline truncate block w-full"
                            title={row.department ?? ""}
                            onClick={() => { setFilterDept(row.department ?? ""); setPage(1); }}
                          >
                            {row.department ?? "—"}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-gray-800 font-medium max-w-[200px]">
                          <span className="truncate block" title={row.vendor ?? ""}>{row.vendor ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[160px]">
                          <span className="truncate block" title={row.item ?? ""}>{row.item ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 max-w-[280px]">
                          <span className="truncate block text-xs" title={row.purpose ?? ""}>{row.purpose ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                          {row.amount === 0 ? (
                            <span className="text-gray-300 font-normal">$0</span>
                          ) : (
                            <span title={fmtFull$(row.amount)}>{fmt$(row.amount)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {row.pdf_url ? (
                            <a
                              href={row.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              title="Open PDF"
                            >
                              PDF
                            </a>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">Page {page} of {totalPages} ({total.toLocaleString()} total)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="bg-gray-100 border-t px-4 py-2 text-[11px] text-gray-400">
        Source:{" "}
        <a href="https://santafenm.gov/city-clerk-1/sunshine-portal/contracts-1" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
          Santa Fe Sunshine Portal
        </a>
        . Database launched 2021; contracts prior may not be included. $0 contracts are agreements, MOUs, or donated services with no monetary value.
      </div>
    </div>
  );
}
