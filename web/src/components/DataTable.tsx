"use client";

import { useEffect, useState, useCallback } from "react";

interface Row {
  objectid: number;
  address: string;
  city: string;
  zip: string;
  owner_name: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  property_class: string;
  acreage: string;
  market_value: number;
  assessed_value: number;
  is_head_of_family: number;
  is_senior_freeze: number;
  neighborhood: string;
  score: number;
  is_likely_second_home: boolean;
}

interface TableResponse {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface OwnerByCount {
  owner_name: string;
  owner_state: string;
  property_count: number;
  total_value: number;
}

interface OwnerByValue {
  owner_name: string;
  owner_state: string;
  property_count: number;
  total_value: number;
}

interface ExpensiveProperty {
  address: string;
  owner_name: string;
  owner_state: string;
  property_class: string;
  neighborhood: string;
  market_value: number;
  score: number;
  is_likely_second_home: boolean;
}

interface LeaderboardData {
  topByCount: OwnerByCount[];
  topByValue: OwnerByValue[];
  mostExpensive: ExpensiveProperty[];
}

type LeaderboardTab = "count" | "value" | "expensive";

function scoreColor(score: number): string {
  if (score >= 6) return "text-red-600 bg-red-50";
  if (score >= 4) return "text-orange-600 bg-orange-50";
  if (score >= 2) return "text-yellow-700 bg-yellow-50";
  return "text-green-600 bg-green-50";
}

function scoreBadge(score: number): string {
  if (score >= 6) return "Very Likely";
  if (score >= 4) return "Likely";
  if (score >= 2) return "Possible";
  return "Primary";
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

type SortKey = "score" | "address" | "owner" | "owner_state" | "market_value" | "property_class" | "neighborhood";

export default function DataTable() {
  const [data, setData] = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [minScore, setMinScore] = useState(0);
  const [ownerState, setOwnerState] = useState("");
  const [propertyClass, setPropertyClass] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [lbOpen, setLbOpen] = useState(true);
  const [lbTab, setLbTab] = useState<LeaderboardTab>("count");
  const [lbLoading, setLbLoading] = useState(false);

  useEffect(() => {
    setLbLoading(true);
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then(setLeaderboard)
      .catch(console.error)
      .finally(() => setLbLoading(false));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "50",
      sortBy,
      sortDir,
      minScore: String(minScore),
    });
    if (ownerState) params.set("ownerState", ownerState);
    if (propertyClass) params.set("propertyClass", propertyClass);
    if (search) params.set("search", search);

    try {
      const resp = await fetch(`/api/table?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const json = await resp.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, minScore, ownerState, propertyClass, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
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
        <div className="font-semibold text-gray-700 mr-2">Filters:</div>

        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Min Score</span>
          <select
            className="border rounded px-2 py-1 text-gray-800 bg-white"
            value={minScore}
            onChange={(e) => { setMinScore(+e.target.value); setPage(1); }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Owner State</span>
          <input
            type="text"
            maxLength={2}
            placeholder="e.g. TX"
            className="border rounded px-2 py-1 w-16 uppercase text-gray-800 bg-white"
            value={ownerState}
            onChange={(e) => { setOwnerState(e.target.value.toUpperCase()); setPage(1); }}
          />
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Class</span>
          <select
            className="border rounded px-2 py-1 text-gray-800 bg-white"
            value={propertyClass}
            onChange={(e) => { setPropertyClass(e.target.value); setPage(1); }}
          >
            <option value="">All</option>
            <option value="SRES">SRES (Single Res)</option>
            <option value="MRES">MRES (Multi Res)</option>
            <option value="CRES">CRES (Condo Res)</option>
            <option value="COMM">COMM (Commercial)</option>
            <option value="VAC">VAC (Vacant)</option>
          </select>
        </label>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Search address or owner..."
            className="border rounded px-2 py-1 w-52 text-gray-800 bg-white"
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
          {data && !loading && <span>{data.total.toLocaleString()} results</span>}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white border-b border-gray-200">
        <button
          onClick={() => setLbOpen((o) => !o)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Owner Leaderboards</span>
          <span className="text-gray-400 text-xs">{lbOpen ? "Hide ▲" : "Show ▼"}</span>
        </button>

        {lbOpen && (
          <div className="px-4 pb-4">
            <div className="flex gap-1 mb-3">
              {([
                ["count", "Most Properties"],
                ["value", "Highest Total Value"],
                ["expensive", "Most Expensive Properties"],
              ] as [LeaderboardTab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setLbTab(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    lbTab === key
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {lbLoading && <div className="text-sm text-gray-400 animate-pulse py-4">Loading leaderboards...</div>}

            {leaderboard && lbTab === "count" && (
              <div className="overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-2 py-1.5 w-8">#</th>
                      <th className="px-2 py-1.5">Owner</th>
                      <th className="px-2 py-1.5">State</th>
                      <th className="px-2 py-1.5 text-right">Properties</th>
                      <th className="px-2 py-1.5 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaderboard.topByCount.map((row, i) => (
                      <tr key={`${row.owner_name}-${row.owner_state}`} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium text-gray-800">{row.owner_name}</td>
                        <td className="px-2 py-1.5 text-gray-500">{row.owner_state || "NM"}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-blue-600">{row.property_count}</td>
                        <td className="px-2 py-1.5 text-right text-gray-600 tabular-nums">{formatCurrency(row.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {leaderboard && lbTab === "value" && (
              <div className="overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-2 py-1.5 w-8">#</th>
                      <th className="px-2 py-1.5">Owner</th>
                      <th className="px-2 py-1.5">State</th>
                      <th className="px-2 py-1.5 text-right">Total Value</th>
                      <th className="px-2 py-1.5 text-right">Properties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaderboard.topByValue.map((row, i) => (
                      <tr key={`${row.owner_name}-${row.owner_state}`} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium text-gray-800">{row.owner_name}</td>
                        <td className="px-2 py-1.5 text-gray-500">{row.owner_state || "NM"}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-green-600 tabular-nums">{formatCurrency(row.total_value)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-600">{row.property_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {leaderboard && lbTab === "expensive" && (
              <div className="overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-2 py-1.5 w-8">#</th>
                      <th className="px-2 py-1.5">Address</th>
                      <th className="px-2 py-1.5">Owner</th>
                      <th className="px-2 py-1.5">State</th>
                      <th className="px-2 py-1.5 text-right">Market Value</th>
                      <th className="px-2 py-1.5">Class</th>
                      <th className="px-2 py-1.5">Neighborhood</th>
                      <th className="px-2 py-1.5 text-center">2nd Home?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaderboard.mostExpensive.map((row, i) => (
                      <tr key={`${row.address}-${i}`} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium text-gray-800">{row.address || "N/A"}</td>
                        <td className="px-2 py-1.5 text-gray-700">{row.owner_name}</td>
                        <td className="px-2 py-1.5 text-gray-500">{row.owner_state || "NM"}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-green-600 tabular-nums">{formatCurrency(row.market_value)}</td>
                        <td className="px-2 py-1.5 text-gray-500">{row.property_class}</td>
                        <td className="px-2 py-1.5 text-gray-500">{row.neighborhood}</td>
                        <td className="px-2 py-1.5 text-center">
                          {row.is_likely_second_home ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold text-red-600 bg-red-50">Yes</span>
                          ) : (
                            <span className="text-xs text-gray-400">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full bg-white">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <SortHeader label="Score" sortKey="score" />
              <SortHeader label="Address" sortKey="address" />
              <SortHeader label="Owner" sortKey="owner" />
              <SortHeader label="Owner Location" sortKey="owner_state" />
              <SortHeader label="Class" sortKey="property_class" />
              <SortHeader label="Market Value" sortKey="market_value" />
              <SortHeader label="Neighborhood" sortKey="neighborhood" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.rows.map((row) => (
              <tr key={row.objectid} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreColor(row.score)}`}>
                    {row.score} - {scoreBadge(row.score)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-800">
                  <div className="font-medium">{row.address || "No address"}</div>
                  <div className="text-xs text-gray-500">{row.zip}</div>
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-800">
                  {row.owner_name || "Unknown"}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600">
                  <div>{row.owner_city}</div>
                  <div className="text-xs font-semibold">{row.owner_state} {row.owner_zip}</div>
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600">{row.property_class}</td>
                <td className="px-3 py-2.5 text-sm text-gray-800 font-medium tabular-nums">
                  {formatCurrency(row.market_value)}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600">{row.neighborhood}</td>
                <td className="px-3 py-2.5 text-xs text-gray-400">
                  {row.acreage} ac
                  {row.is_head_of_family ? " | HoF" : ""}
                  {row.is_senior_freeze ? " | Sr" : ""}
                </td>
              </tr>
            ))}
            {data?.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">No results found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
          <div className="text-gray-500">
            Page {data.page} of {data.totalPages} ({data.total.toLocaleString()} total)
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
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
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
