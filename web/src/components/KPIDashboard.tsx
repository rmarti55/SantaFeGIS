"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  CartesianGrid,
  ZAxis,
  Legend,
} from "recharts";
import kpiData from "@/data/fy26-kpis.json";
import budgetData from "@/data/budget-fy26.json";

const TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "none",
  borderRadius: "8px",
  color: "#f9fafb",
  fontSize: "13px",
  padding: "8px 12px",
};

const DEPT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9",
];

const CATEGORY_COLORS: Record<string, string> = {
  response_time: "#3b82f6",
  compliance: "#10b981",
  satisfaction: "#f59e0b",
  staffing: "#8b5cf6",
  financial: "#ef4444",
  service_delivery: "#06b6d4",
  infrastructure: "#f97316",
};

const CATEGORY_LABELS: Record<string, string> = {
  response_time: "Response Time",
  compliance: "Compliance",
  satisfaction: "Satisfaction",
  staffing: "Staffing",
  financial: "Financial",
  service_delivery: "Service Delivery",
  infrastructure: "Infrastructure",
};

function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

interface KPI {
  metric: string;
  target: string;
  unit?: string;
  category: string;
}

interface Objective {
  id: string;
  description: string;
  targetDate?: string;
  kpis: KPI[];
}

interface Goal {
  id: string;
  title: string;
  objectives: Objective[];
}

interface Department {
  id: string;
  name: string;
  director: string;
  budgetDeptNames: string[];
  goals: Goal[];
}

const departments = kpiData.departments as Department[];

function getDeptBudget(dept: Department) {
  if (!dept.budgetDeptNames.length) return null;
  const matches = budgetData.departmentExpenditures.filter((b) =>
    dept.budgetDeptNames.includes(b.department)
  );
  if (!matches.length) return null;
  const total = matches.reduce((s, m) => s + m.fy26, 0);
  const change = matches.reduce((s, m) => s + m.change, 0);
  return { total, change };
}

function countKPIs(dept: Department): number {
  return dept.goals.reduce(
    (sum, g) => sum + g.objectives.reduce((s, o) => s + o.kpis.length, 0),
    0
  );
}

function allKPIs(dept: Department): KPI[] {
  return dept.goals.flatMap((g) => g.objectives.flatMap((o) => o.kpis));
}

function KpiCard({
  label,
  value,
  accent = "blue",
}: {
  label: string;
  value: string | number;
  accent?: "blue" | "green" | "amber" | "purple";
}) {
  const ring = {
    blue: "ring-blue-500/30 bg-blue-500/5",
    green: "ring-emerald-500/30 bg-emerald-500/5",
    amber: "ring-amber-500/30 bg-amber-500/5",
    purple: "ring-purple-500/30 bg-purple-500/5",
  }[accent];
  const text = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    purple: "text-purple-600",
  }[accent];

  return (
    <div className={`rounded-xl ring-1 ${ring} px-5 py-4`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${text}`}>{value}</p>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? "#64748b";
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

function DepartmentCard({
  dept,
  isOpen,
  onToggle,
}: {
  dept: Department;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const budget = getDeptBudget(dept);
  const kpiCount = countKPIs(dept);
  const goalCount = dept.goals.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        <span
          className="text-lg shrink-0 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          &#9654;
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-gray-900">{dept.name}</h3>
            <span className="text-xs text-gray-500">{dept.director}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span>
              {goalCount} goal{goalCount !== 1 ? "s" : ""}
            </span>
            <span>
              {kpiCount} KPI{kpiCount !== 1 ? "s" : ""}
            </span>
            {budget && (
              <>
                <span className="font-medium text-gray-700">
                  Budget: {fmtM(budget.total)}
                </span>
                <span
                  className={
                    budget.change >= 0 ? "text-emerald-600" : "text-red-500"
                  }
                >
                  {budget.change >= 0 ? "+" : ""}
                  {fmtM(budget.change)} YoY
                </span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
          {kpiCount}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {dept.goals.map((goal) => (
            <div key={goal.id}>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">
                {goal.title}
              </h4>
              <div className="space-y-2 ml-3">
                {goal.objectives.map((obj) => (
                  <div key={obj.id} className="text-sm">
                    <p className="text-gray-600">
                      {obj.description}
                      {obj.targetDate && (
                        <span className="ml-2 text-xs text-gray-400">
                          by {obj.targetDate}
                        </span>
                      )}
                    </p>
                    {obj.kpis.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {obj.kpis.map((kpi, ki) => (
                          <div
                            key={ki}
                            className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
                          >
                            <CategoryBadge category={kpi.category} />
                            <span className="text-gray-700">{kpi.metric}</span>
                            <span className="font-bold text-gray-900">
                              {kpi.target}
                              {kpi.unit === "%" ? "%" : kpi.unit === "$" ? "" : ""}
                            </span>
                            {kpi.unit &&
                              kpi.unit !== "%" &&
                              kpi.unit !== "count" &&
                              kpi.unit !== "$" && (
                                <span className="text-gray-400">
                                  {kpi.unit}
                                </span>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScatterTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-semibold text-sm">{d.name}</p>
      <p className="text-xs mt-1">Budget: {fmtM(d.budget)}</p>
      <p className="text-xs">KPIs: {d.kpis}</p>
      <p className="text-xs text-gray-400">
        {fmtM(d.ratio)}/KPI
      </p>
    </div>
  );
}

export default function KPIDashboard() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());

  const toggleDept = (id: string) => {
    setOpenDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalGoals = departments.reduce((s, d) => s + d.goals.length, 0);
  const totalObjectives = departments.reduce(
    (s, d) => s + d.goals.reduce((gs, g) => gs + g.objectives.length, 0),
    0
  );
  const totalKPIs = departments.reduce((s, d) => s + countKPIs(d), 0);

  const allKPIsFlat = useMemo(
    () => departments.flatMap((d) => allKPIs(d)),
    []
  );

  const categoryDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    allKPIsFlat.forEach((k) => {
      counts[k.category] = (counts[k.category] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({
        name: CATEGORY_LABELS[name] ?? name,
        value,
        key: name,
      }))
      .sort((a, b) => b.value - a.value);
  }, [allKPIsFlat]);

  const kpisByDept = useMemo(
    () =>
      departments
        .map((d) => ({
          name: d.name.replace(" Department", "").replace(" Office", ""),
          kpis: countKPIs(d),
          fill: DEPT_COLORS[departments.indexOf(d) % DEPT_COLORS.length],
        }))
        .sort((a, b) => b.kpis - a.kpis),
    []
  );

  const scatterData = useMemo(() => {
    return departments
      .filter((d) => getDeptBudget(d) !== null && countKPIs(d) > 0)
      .map((d) => {
        const budget = getDeptBudget(d)!;
        const kpis = countKPIs(d);
        return {
          name: d.name.replace(" Department", "").replace(" Office", ""),
          budget: budget.total,
          kpis,
          ratio: budget.total / kpis,
        };
      });
  }, []);

  const ratioData = useMemo(
    () =>
      [...scatterData]
        .sort((a, b) => b.ratio - a.ratio)
        .map((d, i) => ({ ...d, fill: DEPT_COLORS[i % DEPT_COLORS.length] })),
    [scatterData]
  );

  const filteredDepts = useMemo(() => {
    let filtered = departments;
    const q = search.toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.director.toLowerCase().includes(q) ||
          d.goals.some(
            (g) =>
              g.title.toLowerCase().includes(q) ||
              g.objectives.some(
                (o) =>
                  o.description.toLowerCase().includes(q) ||
                  o.kpis.some((k) => k.metric.toLowerCase().includes(q))
              )
          )
      );
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter((d) =>
        allKPIs(d).some((k) => k.category === categoryFilter)
      );
    }
    return filtered;
  }, [search, categoryFilter]);

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Departments" value={departments.length} accent="blue" />
        <KpiCard label="Goals" value={totalGoals} accent="green" />
        <KpiCard label="Objectives" value={totalObjectives} accent="amber" />
        <KpiCard label="Measurable KPIs" value={totalKPIs} accent="purple" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPIs by Department */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            KPIs by Department
          </h3>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={kpisByDept}
              layout="vertical"
              margin={{ left: 140, right: 20, top: 5, bottom: 5 }}
            >
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11 }}
                width={135}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="kpis" radius={[0, 4, 4, 0]}>
                {kpisByDept.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* KPI Categories Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            KPI Categories
          </h3>
          <ResponsiveContainer width="100%" height={380}>
            <PieChart>
              <Pie
                data={categoryDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={130}
                paddingAngle={2}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={true}
              >
                {categoryDistribution.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={CATEGORY_COLORS[entry.key] ?? "#64748b"}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Budget vs KPIs Scatter */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Budget vs KPI Count
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Larger bubbles = higher budget per KPI
          </p>
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="budget"
                type="number"
                name="Budget"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => fmtM(v)}
              />
              <YAxis
                dataKey="kpis"
                type="number"
                name="KPIs"
                tick={{ fontSize: 11 }}
              />
              <ZAxis
                dataKey="ratio"
                range={[60, 600]}
                name="Budget/KPI"
              />
              <Tooltip content={<ScatterTooltipContent />} />
              <Legend />
              <Scatter
                name="Departments"
                data={scatterData}
                fill="#3b82f6"
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Budget per KPI Ratio */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Budget per KPI
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Higher = fewer accountability metrics relative to budget
          </p>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={ratioData}
              layout="vertical"
              margin={{ left: 140, right: 20, top: 5, bottom: 5 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => fmtM(v)}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11 }}
                width={135}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number) => fmtM(v)}
              />
              <Bar dataKey="ratio" name="$/KPI" radius={[0, 4, 4, 0]}>
                {ratioData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search departments, goals, objectives, or KPIs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Department Cards */}
      <div className="space-y-3">
        {filteredDepts.map((dept) => (
          <DepartmentCard
            key={dept.id}
            dept={dept}
            isOpen={openDepts.has(dept.id)}
            onToggle={() => toggleDept(dept.id)}
          />
        ))}
        {filteredDepts.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            No departments match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
