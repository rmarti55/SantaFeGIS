"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  PROBLEM_TYPES,
  PROBLEM_TYPE_COLORS,
  STATUS_LABELS,
  FLAT_PROBLEM_TYPES,
} from "@/lib/arcgis";


interface Stats {
  total: number;
  avgResolveDays: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byProblem: { problem: string; count: number }[];
  subproblemTop20?: { problem: string; count: number }[];
  subproblemPieTop10?: { problem: string | null; count: number }[];
  subproblemPieRestCount?: number;
  openProblems?: { problem: string | null; count: number }[];
}

const PIE_REST_COLOR = "#9ca3af";

/** Dots / pie slices for global sub-problem charts (20 ranks). */
const SUB_PROBLEM_CHART_COLORS = [
  "#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626",
  "#db2777", "#4f46e5", "#0d9488", "#ea580c", "#65a30d",
  "#0891b2", "#4d7c0f", "#b45309", "#7e22ce", "#be185d",
  "#0369a1", "#15803d", "#a16207", "#c2410c", "#475569", "#9333ea",
];

const STATUS_COLORS: Record<string, string> = {
  closed: "#22c55e",
  cs_only_resolved: "#86efac",
  "In progress": "#3b82f6",
  Received: "#a78bfa",
  Submitted: "#f59e0b",
  historical: "#d1d5db",
};

const STATUS_LABELS_LOCAL: Record<string, string> = {
  historical: "Historical (pre-2026, status not recorded)",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "none",
  borderRadius: "8px",
  color: "#f9fafb",
  fontSize: "13px",
};

function pct(n: number, total: number): string {
  if (!total) return "0";
  return ((n / total) * 100).toFixed(1);
}

function problemPieLabel(problem: string | null): string {
  if (problem == null) return "(null)";
  if (problem === "") return "(blank)";
  return problem;
}


export default function WorkOrderStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  const [drillType, setDrillType] = useState<string | null>(null);
  const [drillStats, setDrillStats] = useState<Stats | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    if (loaded.current) return;
    setLoading(true);
    fetch("/api/work-orders/stats")
      .then((r) => r.json())
      .then((data) => { setStats(data); loaded.current = true; })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDrill = useCallback((typeCode: string) => {
    setDrillType(typeCode);
    setDrillStats(null);
    setDrillLoading(true);
    fetch(`/api/work-orders/stats?problemtype=${typeCode}`)
      .then((r) => r.json())
      .then(setDrillStats)
      .catch(console.error)
      .finally(() => setDrillLoading(false));
  }, []);

  const handleBack = useCallback(() => {
    setDrillType(null);
    setDrillStats(null);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  if (!stats) return null;

  // ---------- TOP-LEVEL OVERVIEW ----------
  if (!drillType) {
    // Open = records with a known non-closed status (live layer: Received, In progress, etc.)
    const openCount = stats.byStatus
      .filter((s) => s.status !== "closed" && s.status !== "cs_only_resolved")
      .reduce((sum, s) => sum + s.count, 0);
    // Closed = everything else (explicitly closed + snapshot records with null status = historical)
    const closedCount = stats.total - openCount;

    const statusPieData = stats.byStatus
      .filter((s) => s.status && s.status.trim() !== "" && s.status !== "null")
      .map((s) => ({
        status: s.status,
        name: STATUS_LABELS_LOCAL[s.status] ?? STATUS_LABELS[s.status] ?? s.status,
        value: s.count,
        color: STATUS_COLORS[s.status] ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);

    const subproblemTop20 = stats.subproblemTop20 ?? [];
    const subRankMax = subproblemTop20[0]?.count ?? 1;

    const pieTop10 = stats.subproblemPieTop10 ?? [];
    const pieRest = stats.subproblemPieRestCount ?? 0;
    const subPieData: {
      name: string;
      fullName: string;
      value: number;
      color: string;
      sliceKey: string;
    }[] = [
      ...pieTop10.map((row, i) => {
        const full = problemPieLabel(row.problem);
        return {
          name: full.length > 36 ? full.slice(0, 36) + "…" : full,
          fullName: full,
          value: row.count,
          color: SUB_PROBLEM_CHART_COLORS[i % SUB_PROBLEM_CHART_COLORS.length],
          sliceKey: `t-${i}-${full}`,
        };
      }),
      ...(pieRest > 0
        ? [
            {
              name: "All other problems",
              fullName:
                "All other problems — every ticket whose Problem is not one of the top 10 buckets above (long tail).",
              value: pieRest,
              color: PIE_REST_COLOR,
              sliceKey: "__rest__",
            },
          ]
        : []),
    ];

    return (
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total", value: stats.total.toLocaleString(), color: "text-gray-800", bg: "bg-white" },
              { label: "Open", value: openCount.toLocaleString(), color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Closed", value: closedCount.toLocaleString(), color: "text-green-600", bg: "bg-green-50" },
              { label: "Avg Days to Resolve", value: String(stats.avgResolveDays), color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Categories", value: String(stats.byType.length), color: "text-indigo-600", bg: "bg-indigo-50" },
            ].map((kpi) => (
              <div key={kpi.label} className={`${kpi.bg} rounded-xl border border-gray-200 p-4`}>
                <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>

          {subPieData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Top 10 sub-problems (all tickets)</h3>
              <p className="text-xs text-gray-500 mb-4">
                Raw CRM <span className="font-medium text-gray-600">Problem</span> field: the 10 most common
                values including Other and null. The grey slice is every remaining ticket (all other Problem
                values combined). Wedges are sized by share of all tickets.
              </p>
              <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
                <div className="w-full max-w-xs h-80 shrink-0 mx-auto lg:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={subPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={118}
                        paddingAngle={0.4}
                        isAnimationActive={false}
                      >
                        {subPieData.map((entry, i) => (
                          <Cell key={entry.sliceKey ?? i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, _name, item) => {
                          const v = Number(value);
                          const label = (item?.payload as { fullName?: string })?.fullName ?? "";
                          return [
                            `${v.toLocaleString()} (${pct(v, stats.total)}% of all tickets)`,
                            label,
                          ];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 w-full max-w-xl max-h-72 overflow-y-auto pr-1 space-y-2">
                  {subPieData.map((row) => (
                    <div key={row.sliceKey} className="flex items-start gap-2 text-sm">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 mt-1"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="text-gray-700 flex-1 min-w-0 leading-snug">{row.fullName}</span>
                      <span className="text-gray-500 tabular-nums text-xs shrink-0">
                        {row.value.toLocaleString()}
                        <span className="text-gray-400"> ({pct(row.value, stats.total)}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Status donut */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">By Status</h3>
              <div className="flex justify-center">
                <div className="w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData} cx="50%" cy="50%"
                        innerRadius={40} outerRadius={75}
                        paddingAngle={2} dataKey="value"
                        isAnimationActive={false}
                      >
                        {statusPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value) => [
                          `${Number(value).toLocaleString()} (${pct(Number(value), stats.total)}%)`,
                          "",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {statusPieData.map((s) => (
                  <div key={s.status} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-600 flex-1">{s.name}</span>
                    <span className="text-gray-500 tabular-nums text-xs">{s.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

          {(stats.openProblems ?? []).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Open &amp; Pending Tickets by Problem</h3>
              <p className="text-xs text-gray-500 mb-4">
                Breakdown of tickets with status Received, In Progress, or Submitted by <span className="font-medium text-gray-600">Problem</span> type.
              </p>
              <div className="space-y-1">
                {(stats.openProblems ?? []).map((row, i) => {
                  const maxCount = (stats.openProblems ?? [])[0]?.count ?? 1;
                  const label = row.problem === null ? "(null)" : row.problem === "" ? "(blank)" : row.problem;
                  return (
                    <div
                      key={`${i}-${label}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left w-full hover:bg-gray-50"
                    >
                      <span className="text-xs text-gray-400 w-5 tabular-nums">{i + 1}</span>
                      <span className="text-sm text-gray-700 flex-1 truncate" title={label}>
                        {label}
                      </span>
                      <div className="w-32 bg-gray-100 rounded-full h-3 overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{
                            width: `${(row.count / maxCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right tabular-nums shrink-0">
                        {row.count.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400 w-12 text-right">
                        {pct(row.count, openCount)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {subproblemTop20.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-1">
                Sub-problem ranking (top 20)
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Raw CRM Problem labels, all tickets. Excludes only the literal Other, blanks, and null.
                Bars compare each row to the #1 volume in this list.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                {subproblemTop20.map((row, i) => (
                  <div
                    key={`${i}-${row.problem}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-left w-full"
                  >
                    <span className="text-xs text-gray-400 w-5 tabular-nums">{i + 1}</span>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          SUB_PROBLEM_CHART_COLORS[i % SUB_PROBLEM_CHART_COLORS.length],
                      }}
                    />
                    <span className="text-sm text-gray-700 flex-1 truncate" title={row.problem}>
                      {row.problem}
                    </span>
                    <div className="w-28 bg-gray-100 rounded-full h-3 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.count / subRankMax) * 100}%`,
                          backgroundColor:
                            SUB_PROBLEM_CHART_COLORS[i % SUB_PROBLEM_CHART_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right tabular-nums shrink-0">
                      {row.count.toLocaleString()}
                    </span>
                    <span className="text-gray-300 text-sm shrink-0">&rsaquo;</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- DRILL-DOWN VIEW ----------
  const drillColor = PROBLEM_TYPE_COLORS[drillType] ?? "#6366f1";
  const drillLabel = PROBLEM_TYPES[drillType] ?? drillType;
  const isFlat = FLAT_PROBLEM_TYPES.has(drillType);
  const typeCount = stats.byType.find((t) => t.type === drillType)?.count ?? 0;

  const drillProblems = drillStats?.byProblem ?? [];
  const drillStatusData = (drillStats?.byStatus ?? [])
    .filter((s) => s.status && s.status.trim() !== "" && s.status !== "null")
    .map((s) => ({
      name: STATUS_LABELS[s.status] ?? s.status,
      value: s.count,
      color: STATUS_COLORS[s.status] ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);
  const drillTotal = drillStats?.total ?? typeCount;

  const barData = drillProblems.slice(0, 20).map((p) => ({
    name: p.problem.length > 40 ? p.problem.slice(0, 40) + "…" : p.problem,
    fullName: p.problem,
    count: p.count,
  }));

  const shoppingCartItem = drillType === "dumping"
    ? drillProblems.find((p) => p.problem === "Shopping Carts")
    : null;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Back + header */}
        <div>
          <button
            onClick={handleBack}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mb-2"
          >
            <span>&lsaquo;</span> All categories
          </button>
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: drillColor }} />
            <h2 className="text-xl font-bold text-gray-800">{drillLabel}</h2>
            <span className="text-sm text-gray-400">
              {drillTotal.toLocaleString()} work orders
            </span>
          </div>
        </div>

        {drillLoading && (
          <div className="text-gray-400 py-8 text-center">Loading…</div>
        )}

        {drillStats && (
          <>
            {/* KPI row for drill */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-2xl font-bold text-gray-800">{drillTotal.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">Total</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {drillStats.byStatus
                    .filter((s) => s.status !== "closed" && s.status !== "cs_only_resolved")
                    .reduce((sum, s) => sum + s.count, 0)
                    .toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">Open</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-2xl font-bold text-green-600">
                  {drillStats.byStatus
                    .filter((s) => s.status === "closed" || s.status === "cs_only_resolved")
                    .reduce((sum, s) => sum + s.count, 0)
                    .toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">Closed</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-2xl font-bold text-amber-600">{drillStats.avgResolveDays}</div>
                <div className="text-xs text-gray-500 mt-1">Avg Days to Resolve</div>
              </div>
            </div>

            {/* Shopping Cart callout for dumping */}
            {shoppingCartItem && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
                <span className="text-amber-500 text-lg leading-none mt-0.5">&#9888;</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Shopping Carts account for {pct(shoppingCartItem.count, drillTotal)}% of Illegal Dumping
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    {shoppingCartItem.count.toLocaleString()} of {drillTotal.toLocaleString()} reports.
                    This is likely from an automated shopping cart retrieval program, not citizen reports.
                  </p>
                </div>
              </div>
            )}

            {isFlat ? (
              /* Flat type: no sub-problems, just show status breakdown */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">Status Breakdown</h3>
                  <div className="flex justify-center mb-4">
                    <div className="w-48 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={drillStatusData} cx="50%" cy="50%"
                            innerRadius={40} outerRadius={75}
                            paddingAngle={2} dataKey="value"
                            isAnimationActive={false}
                          >
                            {drillStatusData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(value) => [
                              `${Number(value).toLocaleString()} (${pct(Number(value), drillTotal)}%)`,
                              "",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {drillStatusData.map((s) => (
                      <div key={s.name} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-gray-600 flex-1">{s.name}</span>
                        <span className="text-gray-500 tabular-nums text-xs">{s.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="text-4xl mb-2">📋</div>
                    <p className="text-sm font-medium">No sub-problem breakdown</p>
                    <p className="text-xs mt-1">
                      This category doesn&apos;t have detailed problem types in the CRM data.
                      All {drillTotal.toLocaleString()} records are filed directly as &ldquo;{drillLabel}&rdquo;.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Rich type: bar chart + ranked list */
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Bar chart */}
                  <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-800 mb-1">Sub-Problem Breakdown</h3>
                    <p className="text-xs text-gray-400 mb-4">
                      {drillProblems.length} distinct sub-problems
                    </p>
                    <ResponsiveContainer width="100%" height={Math.max(280, barData.length * 30 + 40)}>
                      <BarChart
                        data={barData}
                        layout="vertical"
                        margin={{ top: 0, right: 10, bottom: 0, left: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          formatter={(value) => [Number(value).toLocaleString(), "Work Orders"]}
                          labelFormatter={(label) => {
                            const item = barData.find((d) => d.name === String(label));
                            return item?.fullName ?? String(label);
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={drillColor} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Status for this type */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">Status</h3>
                    <div className="flex justify-center mb-4">
                      <div className="w-40 h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={drillStatusData} cx="50%" cy="50%"
                              innerRadius={35} outerRadius={65}
                              paddingAngle={2} dataKey="value"
                              isAnimationActive={false}
                            >
                              {drillStatusData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={TOOLTIP_STYLE}
                              formatter={(value) => [
                                `${Number(value).toLocaleString()} (${pct(Number(value), drillTotal)}%)`,
                                "",
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {drillStatusData.map((s) => (
                        <div key={s.name} className="flex items-center gap-2 text-sm">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-gray-600 flex-1">{s.name}</span>
                          <span className="text-gray-500 tabular-nums text-xs">{s.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Full ranked list */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">All Sub-Problems</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
                    {drillProblems.map((p, i) => {
                      const maxCount = drillProblems[0]?.count ?? 1;
                      return (
                        <div
                          key={p.problem}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50"
                        >
                          <span className="text-xs text-gray-400 w-5 tabular-nums">{i + 1}</span>
                          <span className="text-sm text-gray-700 flex-1 truncate" title={p.problem}>
                            {p.problem}
                          </span>
                          <div className="w-20 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(p.count / maxCount) * 100}%`,
                                backgroundColor: drillColor,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-14 text-right tabular-nums">
                            {p.count.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-gray-400 w-12 text-right">
                            {pct(p.count, drillTotal)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
