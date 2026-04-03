"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Treemap,
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
}

const STATUS_COLORS: Record<string, string> = {
  closed: "#22c55e",
  cs_only_resolved: "#86efac",
  "In progress": "#3b82f6",
  Received: "#a78bfa",
  Submitted: "#f59e0b",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapContent(props: any) {
  const { x, y, width, height, name, value, color, total } = props;
  if (width < 4 || height < 4) return null;
  const showLabel = width > 55 && height > 28;
  const showValue = width > 65 && height > 42;
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height} rx={3}
        fill={color} stroke="#fff" strokeWidth={2}
        style={{ cursor: "pointer" }}
      />
      {showLabel && (
        <text
          x={x + width / 2} y={y + height / 2 - (showValue ? 8 : 0)}
          textAnchor="middle" fill="#fff"
          fontSize={width < 100 ? 10 : 13} fontWeight={400}
          paintOrder="stroke" stroke="rgba(0,0,0,0.3)" strokeWidth={3}
        >
          {name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + "…" : name}
        </text>
      )}
      {showValue && (
        <text
          x={x + width / 2} y={y + height / 2 + 12}
          textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={10}
          paintOrder="stroke" stroke="rgba(0,0,0,0.25)" strokeWidth={2.5}
        >
          {value.toLocaleString()} ({pct(value, total)}%)
        </text>
      )}
    </g>
  );
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
    const openCount = stats.byStatus
      .filter((s) => s.status !== "closed" && s.status !== "cs_only_resolved")
      .reduce((sum, s) => sum + s.count, 0);
    const closedCount = stats.byStatus
      .filter((s) => s.status === "closed" || s.status === "cs_only_resolved")
      .reduce((sum, s) => sum + s.count, 0);

    const treemapData = stats.byType.map((t) => ({
      name: PROBLEM_TYPES[t.type] ?? t.type,
      value: t.count,
      color: PROBLEM_TYPE_COLORS[t.type] ?? "#94a3b8",
      typeCode: t.type,
      total: stats.total,
    }));

    const statusPieData = stats.byStatus
      .filter((s) => s.status && s.status.trim() !== "" && s.status !== "null")
      .map((s) => ({
        name: STATUS_LABELS[s.status] ?? s.status,
        value: s.count,
        color: STATUS_COLORS[s.status] ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);

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

          {/* Main content: treemap + status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Treemap */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-1">All Categories</h3>
              <p className="text-xs text-gray-400 mb-4">Click any category to see its breakdown</p>
              <ResponsiveContainer width="100%" height={360}>
                <Treemap
                  data={treemapData}
                  dataKey="value"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  isAnimationActive={false}
                  content={<TreemapContent />}
                  onClick={(node) => {
                    if (node?.typeCode) handleDrill(node.typeCode as string);
                  }}
                />
              </ResponsiveContainer>
            </div>

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
                  <div key={s.name} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-600 flex-1">{s.name}</span>
                    <span className="text-gray-500 tabular-nums text-xs">{s.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category ranking */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Category Ranking</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              {stats.byType.map((t, i) => {
                const maxCount = stats.byType[0]?.count ?? 1;
                const isFlat = FLAT_PROBLEM_TYPES.has(t.type);
                return (
                  <button
                    key={t.type}
                    className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors text-left group w-full"
                    onClick={() => handleDrill(t.type)}
                  >
                    <span className="text-xs text-gray-400 w-5 tabular-nums">{i + 1}</span>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: PROBLEM_TYPE_COLORS[t.type] ?? "#94a3b8" }}
                    />
                    <span className="text-sm text-gray-700 flex-1 truncate group-hover:text-gray-900">
                      {PROBLEM_TYPES[t.type] ?? t.type}
                    </span>
                    <div className="w-28 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(t.count / maxCount) * 100}%`,
                          backgroundColor: PROBLEM_TYPE_COLORS[t.type] ?? "#94a3b8",
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right tabular-nums">
                      {t.count.toLocaleString()}
                    </span>
                    {!isFlat && (
                      <span className="text-gray-300 group-hover:text-gray-500 text-sm">&rsaquo;</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
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
