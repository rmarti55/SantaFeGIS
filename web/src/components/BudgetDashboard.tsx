"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Treemap,
} from "recharts";
import budgetData from "@/data/budget-fy26.json";
import csData from "@/data/pw-complete-streets.json";
import parksData from "@/data/pw-parks.json";
import mrcData from "@/data/pw-mrc.json";
import facilitiesData from "@/data/pw-facilities.json";
import transitData from "@/data/pw-transit.json";
import parkingData from "@/data/pw-parking.json";
import adminData from "@/data/pw-admin.json";
import mpoData from "@/data/pw-mpo.json";
import {
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_CURSOR_STYLE,
} from "@/lib/chartTooltip";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TV = any;

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
];

const DEPT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9", "#d946ef",
  "#22c55e", "#eab308", "#64748b", "#fb923c", "#2dd4bf",
  "#78716c",
];

function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtFull(n: number): string {
  return `$${n.toLocaleString()}`;
}

function pct(n: number, total: number): string {
  if (!total) return "0";
  return ((n / total) * 100).toFixed(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTreemapContent(props: any) {
  const { x, y, width, height, name, value } = props;
  if (width < 40 || height < 30) return null;
  const total = budgetData.meta.totalGeneralFund;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4}
        fill={DEPT_COLORS[props.index % DEPT_COLORS.length]}
        stroke="#1e293b" strokeWidth={2} />
      <text x={x + width / 2} y={y + height / 2 - 8}
        textAnchor="middle" fill="#fff" fontSize={width < 80 ? 10 : 12} fontWeight={600}>
        {width < 80 ? (name?.slice(0, 10) ?? "") : (name ?? "")}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10}
        textAnchor="middle" fill="#ffffffcc" fontSize={10}>
        {fmtM(value)} ({pct(value, total)}%)
      </text>
    </g>
  );
}

const CATEGORY_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48",
];

const categoryBreakdownMap = new Map(
  budgetData.departmentCategoryBreakdowns.map((d) => [
    d.department,
    d.categories.map((c) => ({ name: c.category, value: c.fy26 })),
  ])
);

const SUBORG_TYPE_COLOR: Record<string, string> = {
  operating: "#3b82f6",
  "debt-service": "#ef4444",
};

const LINEITEM_CAT_COLOR: Record<string, string> = {
  overhead: "#8b5cf6",
  contracts: "#3b82f6",
  materials: "#10b981",
  utilities: "#f59e0b",
  "capital-transfer": "#6b7280",
  capital: "#14b8a6",
  technology: "#06b6d4",
  fuel: "#f97316",
  debt: "#ef4444",
};

const DIVISION_DATA: Record<string, typeof csData> = {
  "Complete Streets":                 csData,
  "Parks Division":                   parksData as unknown as typeof csData,
  "Municipal Recreation Complex":     mrcData as unknown as typeof csData,
  "Facilities Maintenance":           facilitiesData as unknown as typeof csData,
  "Transit":                          transitData as unknown as typeof csData,
  "Parking Division":                 parkingData as unknown as typeof csData,
  "Public Works Admin":               adminData as unknown as typeof csData,
  "Metropolitan Planning Organization": mpoData as unknown as typeof csData,
};

function ChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

export default function BudgetDashboard() {
  const { meta } = budgetData;
  const [selectedDept,   setSelectedDept]   = useState<string | null>(null);
  const [selectedDiv,    setSelectedDiv]    = useState<string | null>(null);
  const [selectedSubOrg, setSelectedSubOrg] = useState<string | null>(null);

  function resetToTop() {
    setSelectedDept(null);
    setSelectedDiv(null);
    setSelectedSubOrg(null);
  }
  function resetToDiv() {
    setSelectedDiv(null);
    setSelectedSubOrg(null);
  }

  const pwDivisions = budgetData.publicWorksDivisions;
  const pwTotal = pwDivisions.reduce((s, d) => s + d.fy26, 0);

  const activeDivData = selectedDiv ? (DIVISION_DATA[selectedDiv] ?? null) : null;
  const divSubOrgs = activeDivData
    ? [...activeDivData.subOrgs].filter((s) => s.total > 0).sort((a, b) => b.total - a.total)
    : [];
  const activeSubOrg = selectedSubOrg && activeDivData
    ? (activeDivData.subOrgs.find((s) => s.name === selectedSubOrg) as TV) ?? null
    : null;

  const deptSorted = [...budgetData.departmentExpenditures].sort(
    (a, b) => b.fy26 - a.fy26
  );
  const deptPieData = deptSorted.map((d) => ({
    name: d.department,
    value: d.fy26,
  }));

  const drillDownData =
    selectedDept && selectedDept !== "Public Works"
      ? categoryBreakdownMap.get(selectedDept) ?? []
      : [];
  const drillDownTotal = drillDownData.reduce((s, d) => s + d.value, 0);

  const spendingByCategory = budgetData.expenditureCategories.categories.map(
    (c) => ({ name: c.category, value: (c.values[4] as number | null) ?? 0 })
  );

  const revenueSourcesFy26 = budgetData.revenueCategories.categories
    .map((c) => ({ name: c.category, value: (c.values[4] as number | null) ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const trendData = budgetData.expenditureCategories.years.map((yr, i) => {
    const row: Record<string, string | number | null> = { year: yr };
    budgetData.expenditureCategories.categories.forEach((c) => {
      row[c.category] = c.values[i] as number | null;
    });
    return row;
  });

  const deptChanges = [...budgetData.departmentExpenditures]
    .filter((d) => d.change !== 0 && d.changePct !== null)
    .sort((a, b) => b.change - a.change);

  const gfTreemap = budgetData.generalFundDepartments.map((d) => ({
    name: d.department,
    value: d.fy26,
  }));

  const backBtnCls =
    "text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 transition-colors";
  const crumbBtnCls =
    "text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors";

  return (
    <div className="space-y-6">
      {/* ── Row 1: KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="All Funds Budget"
          value={fmtM(meta.totalAllFunds)}
          sub="Total FY26 Expenditures"
          accent="blue"
        />
        <KpiCard
          label="General Fund"
          value={fmtM(meta.totalGeneralFund)}
          sub={`${pct(meta.totalGeneralFund, meta.totalAllFunds)}% of all funds`}
          accent="emerald"
        />
        <KpiCard
          label="YoY Change"
          value={`+${fmtM(meta.yoyChangeAmount)}`}
          sub={`+${meta.yoyChangePercent}% from FY25`}
          accent="amber"
        />
        <KpiCard
          label="Total Revenue"
          value={fmtM(meta.totalRevenue)}
          sub={`Surplus: ${fmtM(meta.totalRevenue - meta.totalAllFunds)}`}
          accent="violet"
        />
      </div>

      {/* ── Row 2: Department Drill-down + Spending Category Donut ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">

          {/* ── LEVEL 0: All Departments Pie ── */}
          {selectedDept === null ? (
            <>
              <h3 className="font-semibold text-gray-800 mb-1">
                Department Spending — All Funds
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Click a slice to drill down into a department&apos;s spending breakdown
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={deptPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={160}
                      dataKey="value"
                      stroke="#fff"
                      strokeWidth={1.5}
                      cursor="pointer"
                      onClick={(entry: TV) => {
                        if (entry?.name) setSelectedDept(entry.name);
                      }}
                    >
                      {deptPieData.map((_, i) => (
                        <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      formatter={(v: TV, _n: TV, entry: TV) => [
                        `${fmtM(Number(v))} (${pct(Number(v), meta.totalAllFunds)}%)`,
                        entry?.payload?.name ?? "",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
                  {deptPieData.map((d, i) => (
                    <button
                      key={d.name}
                      onClick={() => setSelectedDept(d.name)}
                      className="flex items-center justify-between text-xs w-full px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }}
                        />
                        <span className="text-gray-700 truncate">{d.name}</span>
                      </span>
                      <span className="text-gray-800 font-medium tabular-nums ml-2 shrink-0">
                        {fmtM(d.value)}{" "}
                        <span className="text-gray-400">
                          ({pct(d.value, meta.totalAllFunds)}%)
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>

          /* ── LEVEL 1: Public Works Divisions ── */
          ) : selectedDept === "Public Works" && !selectedDiv ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={resetToTop} className={backBtnCls}>
                  <ChevronLeft /> All Departments
                </button>
                <span className="text-gray-400 text-sm">/</span>
                <h3 className="font-semibold text-gray-800 text-sm">Public Works</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                {fmtM(pwTotal)} total across 7 divisions — click a division to explore
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={pwDivisions}
                    layout="vertical"
                    margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tickFormatter={fmtM}
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="division"
                      width={155}
                      tick={{ fontSize: 11, fill: "#374151" }}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      cursor={TOOLTIP_CURSOR_STYLE}
                      formatter={(v: TV) => fmtM(Number(v))}
                    />
                    <Bar
                      dataKey="fy26"
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(entry: TV) => {
                        if (entry?.division) setSelectedDiv(entry.division);
                      }}
                    >
                      {pwDivisions.map((_, i) => (
                        <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1 max-h-[320px] overflow-y-auto pr-2">
                  {pwDivisions.map((d, i) => (
                    <button
                      key={d.division}
                      onClick={() => setSelectedDiv(d.division)}
                      className="flex items-start justify-between text-xs w-full px-2 py-2 rounded-md hover:bg-gray-50 transition-colors text-left gap-2"
                    >
                      <span className="flex items-start gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }}
                        />
                        <span className="min-w-0">
                          <span className="text-gray-700 font-medium block">
                            {d.division}
                            {d.division in DIVISION_DATA && (
                              <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-normal">
                                Detail available
                              </span>
                            )}
                          </span>
                          <span className="text-gray-400 block leading-snug mt-0.5">
                            {d.note}
                          </span>
                        </span>
                      </span>
                      <span className="text-gray-800 font-medium tabular-nums shrink-0">
                        {fmtM(d.fy26)}{" "}
                        <span className="text-gray-400">({pct(d.fy26, pwTotal)}%)</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>

          /* ── LEVEL 2: PW Division Detail (data-driven for all 8 divisions) ── */
          ) : selectedDept === "Public Works" && selectedDiv && activeDivData ? (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={resetToTop} className={backBtnCls}>
                  <ChevronLeft /> All Departments
                </button>
                <span className="text-gray-400 text-sm">/</span>
                <button onClick={resetToDiv} className={crumbBtnCls}>
                  Public Works
                </button>
                <span className="text-gray-400 text-sm">/</span>
                <h3 className="font-semibold text-gray-800 text-sm">{selectedDiv}</h3>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-0.5">
                    Operating
                  </p>
                  <p className="text-lg font-bold text-blue-700 tabular-nums">
                    {fmtM(activeDivData.operatingTotal)}
                  </p>
                  <p className="text-xs text-blue-400">Day-to-day ops</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">
                    Capital Layer
                  </p>
                  <p className="text-lg font-bold text-gray-700 tabular-nums">
                    {activeDivData.capitalTotal > 0 ? "~" : ""}{fmtM(activeDivData.capitalTotal)}
                  </p>
                  <p className="text-xs text-gray-400">Bond / grants</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                  <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mb-0.5">
                    Total Adopted
                  </p>
                  <p className="text-lg font-bold text-emerald-700 tabular-nums">
                    {fmtM(activeDivData.grandTotal)}
                  </p>
                  <p className="text-xs text-emerald-400">FY26 adopted</p>
                </div>
              </div>

              {/* Two-column: bar chart left, detail right */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Sub-org bar chart */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">
                    Click a bar to see line items — click again to deselect
                  </p>
                  <ResponsiveContainer width="100%" height={370}>
                    <BarChart
                      data={divSubOrgs}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tickFormatter={fmtM}
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={190}
                        tick={{ fontSize: 10, fill: "#374151" }}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_CONTENT_STYLE}
                        labelStyle={TOOLTIP_LABEL_STYLE}
                        itemStyle={TOOLTIP_ITEM_STYLE}
                        cursor={TOOLTIP_CURSOR_STYLE}
                        formatter={(v: TV) => fmtM(Number(v))}
                      />
                      <Bar
                        dataKey="total"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(entry: TV) => {
                          const name = entry?.name ?? null;
                          setSelectedSubOrg((prev) => (prev === name ? null : name));
                        }}
                      >
                        {divSubOrgs.map((s) => (
                          <Cell
                            key={s.name}
                            fill={
                              s.name === selectedSubOrg
                                ? "#1d4ed8"
                                : (SUBORG_TYPE_COLOR[s.type] ?? "#3b82f6")
                            }
                            opacity={
                              selectedSubOrg && s.name !== selectedSubOrg ? 0.45 : 1
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Right panel: line items OR category donut */}
                <div className="min-h-[370px]">
                  {activeSubOrg ? (
                    /* Line-item detail panel */
                    <div>
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 text-sm leading-tight">
                            {activeSubOrg.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {activeSubOrg.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-gray-900 tabular-nums text-sm">
                            {fmtFull(activeSubOrg.total)}
                          </p>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full inline-block mt-0.5"
                            style={{
                              backgroundColor:
                                (SUBORG_TYPE_COLOR[activeSubOrg.type] ?? "#3b82f6") + "20",
                              color: SUBORG_TYPE_COLOR[activeSubOrg.type] ?? "#3b82f6",
                            }}
                          >
                            {activeSubOrg.type}
                          </span>
                        </div>
                      </div>
                      {activeSubOrg.lineItems.length > 0 ? (
                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                          {activeSubOrg.lineItems.map((item: TV) => (
                            <div
                              key={item.name}
                              className="bg-gray-50 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs text-gray-700 font-medium leading-snug">
                                  {item.name}
                                </span>
                                <span className="text-xs font-bold text-gray-900 tabular-nums shrink-0">
                                  {fmtFull(item.amount)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      (LINEITEM_CAT_COLOR[item.category] ?? "#6b7280") + "20",
                                    color: LINEITEM_CAT_COLOR[item.category] ?? "#6b7280",
                                  }}
                                >
                                  {item.category}
                                </span>
                                {item.note && (
                                  <span className="text-xs text-amber-600 font-medium">
                                    {item.note}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic mt-2">
                          Sub-org total: {fmtFull(activeSubOrg.total)}. See spending categories for the division-level breakdown.
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Category spend donut (default) */
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">
                        Operating Budget by Spending Type
                      </p>
                      <p className="text-xs text-gray-400 mb-2">
                        Select a sub-org bar to see line items
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={activeDivData.spendingCategories}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={88}
                            paddingAngle={2}
                            dataKey="amount"
                            stroke="none"
                          >
                            {activeDivData.spendingCategories.map((c, i) => (
                              <Cell key={i} fill={c.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={TOOLTIP_CONTENT_STYLE}
                            labelStyle={TOOLTIP_LABEL_STYLE}
                            itemStyle={TOOLTIP_ITEM_STYLE}
                            formatter={(v: TV, _: TV, entry: TV) => [
                              fmtM(Number(v)),
                              entry?.payload?.name ?? "",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-1">
                        {activeDivData.spendingCategories.map((c) => (
                          <div
                            key={c.name}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: c.color }}
                              />
                              <span className="text-gray-600 truncate">{c.name}</span>
                            </span>
                            <span className="text-gray-800 font-medium tabular-nums ml-2 shrink-0">
                              {fmtM(c.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Capital layer note */}
              {activeDivData.capitalNote && (
                <p className="text-xs text-gray-400 italic mt-4 pt-3 border-t border-gray-100">
                  {activeDivData.capitalNote}
                </p>
              )}
            </>

          /* ── Fallback: existing category breakdown for other departments ── */
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={resetToTop} className={backBtnCls}>
                  <ChevronLeft /> All Departments
                </button>
                <span className="text-gray-400 text-sm">/</span>
                <h3 className="font-semibold text-gray-800 text-sm">{selectedDept}</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                {fmtM(drillDownTotal)} total — spending by category
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={drillDownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={160}
                      paddingAngle={1.5}
                      dataKey="value"
                      stroke="none"
                    >
                      {drillDownData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      formatter={(v: TV, _n: TV, entry: TV) => [
                        `${fmtFull(Number(v))} (${pct(Number(v), drillDownTotal)}%)`,
                        entry?.payload?.name ?? "",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {drillDownData.map((d, i) => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                            }}
                          />
                          <span className="text-gray-700">{d.name}</span>
                        </span>
                        <span className="text-gray-800 font-medium tabular-nums">
                          {fmtM(d.value)}{" "}
                          <span className="text-gray-400">
                            ({pct(d.value, drillDownTotal)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(d.value / drillDownData[0].value) * 100}%`,
                            backgroundColor:
                              CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Spending by Category donut — unchanged */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Spending by Category</h3>
          <p className="text-xs text-gray-400 mb-4">
            FY26 all funds — {fmtM(meta.totalAllFunds)} total
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={spendingByCategory}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {spendingByCategory.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                formatter={(v: TV) => [
                  `${fmtM(Number(v))} (${pct(Number(v), meta.totalAllFunds)}%)`,
                  "",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {spendingByCategory.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-gray-600">{d.name}</span>
                </span>
                <span className="text-gray-800 font-medium tabular-nums">
                  {fmtM(d.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Revenue Sources + 5-Year Trend ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Revenue Sources</h3>
          <p className="text-xs text-gray-400 mb-4">
            FY26 all funds — {fmtM(meta.totalRevenue)} total
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={revenueSourcesFy26}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {revenueSourcesFy26.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                formatter={(v: TV) => [
                  `${fmtM(Number(v))} (${pct(Number(v), meta.totalRevenue)}%)`,
                  "",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {revenueSourcesFy26.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-gray-600">{d.name}</span>
                </span>
                <span className="text-gray-800 font-medium tabular-nums">
                  {fmtM(d.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">
            Expenditure Trend — 5-Year History
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            All funds spending by category, FY22 through FY26
          </p>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart
              data={trendData}
              margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis
                tickFormatter={fmtM}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                width={70}
              />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={TOOLTIP_CURSOR_STYLE}
                formatter={(v: TV) => fmtFull(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {budgetData.expenditureCategories.categories.map((c, i) => (
                <Line
                  key={c.category}
                  type="monotone"
                  dataKey={c.category}
                  stroke={PIE_COLORS[i]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 4: Revenue vs. Expenditure + Department YoY Changes ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Revenue vs. Expenditure</h3>
          <p className="text-xs text-gray-400 mb-4">All funds — 5-year comparison</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={budgetData.revVsExp}
              margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis
                tickFormatter={fmtM}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                width={70}
              />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={TOOLTIP_CURSOR_STYLE}
                formatter={(v: TV) => fmtFull(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="expenditure"
                name="Expenditure"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Budget Change by Department</h3>
          <p className="text-xs text-gray-400 mb-4">FY25 to FY26 — dollar change</p>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={deptChanges}
              layout="vertical"
              margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tickFormatter={fmtM}
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <YAxis
                type="category"
                dataKey="department"
                width={160}
                tick={{ fontSize: 11, fill: "#374151" }}
              />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={TOOLTIP_CURSOR_STYLE}
                formatter={(v: TV, _: TV, entry: TV) => {
                  const val = Number(v);
                  const p = entry?.payload?.changePct ?? null;
                  const pStr = p !== null ? ` (${p > 0 ? "+" : ""}${p}%)` : "";
                  return [`${val >= 0 ? "+" : ""}${fmtFull(val)}${pStr}`, "Change"];
                }}
              />
              <ReferenceLine x={0} stroke="#9ca3af" strokeWidth={1} />
              <Bar dataKey="change" radius={[0, 4, 4, 0]}>
                {deptChanges.map((d, i) => (
                  <Cell key={i} fill={d.change >= 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 5: General Fund Treemap ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-1">General Fund Breakdown</h3>
        <p className="text-xs text-gray-400 mb-4">
          {fmtM(meta.totalGeneralFund)} across {gfTreemap.length} departments
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <Treemap
            data={gfTreemap}
            dataKey="value"
            aspectRatio={4 / 3}
            stroke="#1e293b"
            content={<CustomTreemapContent />}
          />
        </ResponsiveContainer>
      </div>

      {/* ── Tax Revenue Breakdown ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Tax Revenue Breakdown</h3>
        <p className="text-xs text-gray-400 mb-4">
          FY26 — {fmtM(207207967)} total tax revenue
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={budgetData.taxBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={110}
                paddingAngle={2}
                dataKey="fy26"
                nameKey="source"
                stroke="none"
              >
                {budgetData.taxBreakdown.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                formatter={(v: TV) => [
                  `${fmtM(Number(v))} (${pct(Number(v), 207207967)}%)`,
                  "",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {budgetData.taxBreakdown.map((t, i) => (
              <div key={t.source}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-gray-700">{t.source}</span>
                  </span>
                  <span className="text-gray-900 font-semibold tabular-nums">
                    {fmtM(t.fy26)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(t.fy26 / 207207967) * 100}%`,
                      backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center pb-4">
        Source: City of Santa Fe Adopted FY 2025-26 Budget Book.
        Excludes Buckman Direct Diversion and SF Solid Waste Management Agency.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "blue" | "emerald" | "amber" | "violet";
}) {
  const border = {
    blue: "border-blue-200",
    emerald: "border-emerald-200",
    amber: "border-amber-200",
    violet: "border-violet-200",
  }[accent];
  const bg = {
    blue: "bg-blue-50",
    emerald: "bg-emerald-50",
    amber: "bg-amber-50",
    violet: "bg-violet-50",
  }[accent];
  const text = {
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    violet: "text-violet-700",
  }[accent];

  return (
    <div className={`rounded-xl border ${border} ${bg} p-4`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${text} tabular-nums`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
