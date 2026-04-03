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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TV = any;

const TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "none",
  borderRadius: "8px",
  color: "#f9fafb",
  fontSize: "13px",
  padding: "8px 12px",
};

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

export default function BudgetDashboard() {
  const { meta } = budgetData;
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const deptSorted = [...budgetData.departmentExpenditures].sort(
    (a, b) => b.fy26 - a.fy26
  );

  const deptPieData = deptSorted.map((d) => ({
    name: d.department,
    value: d.fy26,
  }));

  const drillDownData = selectedDept ? categoryBreakdownMap.get(selectedDept) ?? [] : [];
  const drillDownTotal = drillDownData.reduce((s, d) => s + d.value, 0);

  const spendingByCategory = budgetData.expenditureCategories.categories.map(
    (c) => ({ name: c.category, value: c.values[4] })
  );

  const revenueSourcesFy26 = budgetData.revenueCategories.categories
    .map((c) => ({ name: c.category, value: c.values[4] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const trendData = budgetData.expenditureCategories.years.map((yr, i) => {
    const row: Record<string, string | number> = { year: yr };
    budgetData.expenditureCategories.categories.forEach((c) => {
      row[c.category] = c.values[i];
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

  return (
    <div className="space-y-6">
      {/* Row 1: KPI Cards */}
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

      {/* Row 2: Department Spending Drill-down Pie + Spending Category Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
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
                      contentStyle={TOOLTIP_STYLE}
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
                        {fmtM(d.value)} <span className="text-gray-400">({pct(d.value, meta.totalAllFunds)}%)</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => setSelectedDept(null)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  All Departments
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
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
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
                            style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                          />
                          <span className="text-gray-700">{d.name}</span>
                        </span>
                        <span className="text-gray-800 font-medium tabular-nums">
                          {fmtM(d.value)} <span className="text-gray-400">({pct(d.value, drillDownTotal)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(d.value / drillDownData[0].value) * 100}%`,
                            backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
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

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">
            Spending by Category
          </h3>
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
                contentStyle={TOOLTIP_STYLE}
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

      {/* Row 3: Revenue Sources Donut + 5-Year Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">
            Revenue Sources
          </h3>
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
                contentStyle={TOOLTIP_STYLE}
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
            <LineChart data={trendData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis tickFormatter={fmtM} tick={{ fontSize: 11, fill: "#6b7280" }} width={70} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
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

      {/* Row 4: Revenue vs Expenditure + Department YoY Changes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">
            Revenue vs. Expenditure
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            All funds — 5-year comparison
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={budgetData.revVsExp}
              margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis tickFormatter={fmtM} tick={{ fontSize: 11, fill: "#6b7280" }} width={70} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: TV) => fmtFull(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenditure" name="Expenditure" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">
            Budget Change by Department
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            FY25 to FY26 — dollar change
          </p>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={deptChanges}
              layout="vertical"
              margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
            >
              <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis
                type="category"
                dataKey="department"
                width={160}
                tick={{ fontSize: 11, fill: "#374151" }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
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

      {/* Row 5: General Fund Treemap */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-1">
          General Fund Breakdown
        </h3>
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

      {/* Tax Revenue Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-1">
          Tax Revenue Breakdown
        </h3>
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
                contentStyle={TOOLTIP_STYLE}
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
