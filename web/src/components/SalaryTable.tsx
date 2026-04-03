"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface Employee {
  department: string;
  division: string;
  position: string;
  hourlyRate: number;
  annualSalary: number;
  lastName: string;
  firstName: string;
}

interface ApiResponse {
  employees: Employee[];
  total: number;
  updatedAt: string;
}

type SortKey =
  | "hourlyRate"
  | "annualSalary"
  | "lastName"
  | "firstName"
  | "department"
  | "division"
  | "position";

const PAGE_SIZE = 50;

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString();
}

function fmtHourly(n: number): string {
  return "$" + n.toFixed(2);
}

export default function SalaryTable() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("hourlyRate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/salaries");
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const json: ApiResponse = await resp.json();
      setEmployees(json.employees);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department));
    return Array.from(set).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    let list = employees;

    if (filterDept) {
      list = list.filter((e) => e.department === filterDept);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.firstName.toLowerCase().includes(q) ||
          e.lastName.toLowerCase().includes(q) ||
          e.position.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q) ||
          e.division.toLowerCase().includes(q)
      );
    }

    const sorted = [...list].sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      const cmp = strA.localeCompare(strB);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [employees, filterDept, search, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    if (employees.length === 0) return null;
    const rates = employees.map((e) => e.hourlyRate).sort((a, b) => a - b);
    const sum = rates.reduce((a, b) => a + b, 0);
    const avg = sum / rates.length;
    const mid = Math.floor(rates.length / 2);
    const median =
      rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid];
    const top = employees[0];

    const deptMap = new Map<string, { sum: number; count: number }>();
    for (const e of employees) {
      const d = deptMap.get(e.department) ?? { sum: 0, count: 0 };
      d.sum += e.hourlyRate;
      d.count++;
      deptMap.set(e.department, d);
    }
    const topDepts = Array.from(deptMap.entries())
      .map(([name, { sum, count }]) => ({ name, avg: sum / count, count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);

    return { total: employees.length, avg, median, top, topDepts };
  }, [employees]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "hourlyRate" || key === "annualSalary" ? "desc" : "asc");
    }
    setPage(1);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const topHourlyRate = filtered.length > 0 ? filtered[0]?.hourlyRate : 0;
  const top10Threshold =
    sortBy === "hourlyRate" && sortDir === "desc"
      ? employees[Math.min(9, employees.length - 1)]?.hourlyRate ?? 0
      : 0;

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
        <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
      )}
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-3" />
          <p>Fetching salary data from santafenm.gov...</p>
          <p className="text-xs mt-1">Scraping 15 pages of employee records</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <div className="text-center">
          <p className="font-medium">Failed to load salary data</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Stats cards */}
      {stats && (
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Total Employees
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {stats.total.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Avg Hourly Rate
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {fmtHourly(stats.avg)}
              </div>
              <div className="text-xs text-gray-400">
                ~{fmtCurrency(Math.round(stats.avg * 2080))}/yr
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Median Hourly Rate
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {fmtHourly(stats.median)}
              </div>
              <div className="text-xs text-gray-400">
                ~{fmtCurrency(Math.round(stats.median * 2080))}/yr
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <div className="text-xs text-amber-700 uppercase tracking-wide">
                Highest Paid
              </div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {stats.top.firstName && stats.top.lastName
                  ? `${stats.top.firstName} ${stats.top.lastName}`
                  : stats.top.position}
              </div>
              <div className="text-xs text-gray-600">
                {stats.top.position} &mdash; {fmtHourly(stats.top.hourlyRate)}/hr (
                {fmtCurrency(stats.top.annualSalary)}/yr)
              </div>
            </div>
          </div>

          {/* Top departments */}
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <span className="text-gray-500 font-medium">Top depts by avg pay:</span>
            {stats.topDepts.map((d) => (
              <button
                key={d.name}
                onClick={() => {
                  setFilterDept(d.name);
                  setPage(1);
                }}
                className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors"
              >
                {d.name}{" "}
                <span className="font-semibold">{fmtHourly(d.avg)}</span>
                <span className="text-blue-400 ml-1">({d.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Search name, position, department..."
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
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(1);
              }}
              className="text-gray-400 hover:text-gray-600 px-2"
            >
              Clear
            </button>
          )}
        </div>

        <select
          className="border rounded px-2 py-1 text-gray-800 bg-white"
          value={filterDept}
          onChange={(e) => {
            setFilterDept(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {filterDept && (
          <button
            onClick={() => {
              setFilterDept("");
              setPage(1);
            }}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            Clear filter
          </button>
        )}

        <div className="ml-auto flex items-center gap-3 text-gray-500">
          <span>{filtered.length.toLocaleString()} employees</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full bg-white">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap w-10">
                #
              </th>
              <SortHeader label="First Name" sortKey="firstName" />
              <SortHeader label="Last Name" sortKey="lastName" />
              <SortHeader label="Department" sortKey="department" />
              <SortHeader label="Division" sortKey="division" />
              <SortHeader label="Position" sortKey="position" />
              <SortHeader
                label="Hourly Rate"
                sortKey="hourlyRate"
                className="text-right"
              />
              <SortHeader
                label="Est. Annual"
                sortKey="annualSalary"
                className="text-right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRows.map((row, i) => {
              const rank = (page - 1) * PAGE_SIZE + i + 1;
              const isTopEarner = row.hourlyRate >= top10Threshold && top10Threshold > 0;
              return (
                <tr
                  key={`${row.lastName}-${row.firstName}-${row.position}-${i}`}
                  className={`hover:bg-gray-50 transition-colors ${
                    isTopEarner ? "bg-amber-50/50" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 text-xs text-gray-400 tabular-nums">
                    {rank}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">
                    {row.firstName || (
                      <span className="text-gray-400 italic">Withheld</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">
                    {row.lastName || (
                      <span className="text-gray-400 italic">Withheld</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600">
                    {row.department}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500 max-w-[200px] truncate">
                    {row.division}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-800 font-medium">
                    {row.position}
                    {isTopEarner && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                        TOP 10
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-900 text-right tabular-nums font-semibold">
                    {fmtHourly(row.hourlyRate)}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-700 text-right tabular-nums">
                    {fmtCurrency(row.annualSalary)}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  No results found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
          <div className="text-gray-500">
            Page {page} of {totalPages} ({filtered.length.toLocaleString()}{" "}
            total)
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-100 border-t px-4 py-2 text-[11px] text-gray-400">
        Source:{" "}
        <a
          href="https://santafenm.gov/human-resources/employee-salaries-positions"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-600"
        >
          santafenm.gov
        </a>
        . Annual salary estimated as hourly rate &times; 2,080 hours (40 hrs/wk
        &times; 52 wks). Actual compensation may vary for part-time or
        variable-hour positions.
      </div>
    </div>
  );
}
