"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "recharts";

interface TopLevel {
  total: number;
  owner_occupied: number;
  not_owner_occupied: number;
  unknown: number;
}

interface OwnerOccDetail {
  with_exemption: number;
  address_match_only: number;
}

interface NotOwnerOccRow {
  category: string;
  count: number;
  has_exemption: number;
  entity_owned: number;
  multi_property: number;
  po_box: number;
}

interface EntityTypeRow {
  entity_type: string;
  count: number;
}

interface StateRow {
  state: string;
  count: number;
}

interface BreakdownData {
  topLevel: TopLevel;
  ownerOccupiedDetail: OwnerOccDetail;
  notOwnerOccupied: NotOwnerOccRow[];
  entityTypes: EntityTypeRow[];
  topStates: StateRow[];
}

type DrillDown = "owner_occupied" | "not_owner_occupied" | "entities" | "states" | null;

const DONUT_COLORS = ["#22c55e", "#ef4444", "#9ca3af"];

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "none",
  borderRadius: "8px",
  color: "#f9fafb",
  fontSize: "13px",
  padding: "8px 12px",
};

function pct(n: number, total: number) {
  if (!total) return "0";
  return ((n / total) * 100).toFixed(1);
}

function fmt(n: number) {
  return (n ?? 0).toLocaleString();
}

export default function OccupancyCharts() {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [drillDown, setDrillDown] = useState<DrillDown>(null);

  useEffect(() => {
    fetch("/api/occupancy-breakdown")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePieClick = useCallback((_: unknown, index: number) => {
    const keys: DrillDown[] = ["owner_occupied", "not_owner_occupied", null];
    setDrillDown((prev) => (prev === keys[index] ? null : keys[index]));
  }, []);

  if (loading) {
    return <div className="p-4 text-gray-400 animate-pulse text-sm">Loading charts...</div>;
  }
  if (!data) {
    return <div className="p-4 text-red-400 text-sm">Failed to load data</div>;
  }

  const { topLevel, ownerOccupiedDetail, notOwnerOccupied, entityTypes, topStates } = data;

  const donutData = [
    { name: "Owner-Occupied", value: Number(topLevel.owner_occupied) },
    { name: "Not Owner-Occupied", value: Number(topLevel.not_owner_occupied) },
    { name: "Unknown", value: Number(topLevel.unknown) },
  ].filter((d) => d.value > 0);

  const total = Number(topLevel.total);

  const ownerOccBars = [
    { name: "Address + Exemption", value: Number(ownerOccupiedDetail.with_exemption), fill: "#16a34a" },
    { name: "Address Match Only", value: Number(ownerOccupiedDetail.address_match_only), fill: "#4ade80" },
  ];

  const notOwnerBars = notOwnerOccupied.map((row) => ({
    name: row.category,
    value: Number(row.count),
    hasExemption: Number(row.has_exemption),
    entityOwned: Number(row.entity_owned),
    fill:
      row.category === "Out of State"
        ? "#dc2626"
        : row.category === "NM, Different City"
          ? "#f97316"
          : row.category === "Same City"
            ? "#eab308"
            : "#9ca3af",
  }));

  const entityBars = entityTypes.map((row, i) => ({
    name: row.entity_type,
    value: Number(row.count),
    fill: ["#7c3aed", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"][i % 5],
  }));

  const stateBars = topStates.map((row) => ({
    name: row.state,
    value: Number(row.count),
    fill: "#ef4444",
  }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-700 mb-1 text-sm">
          All Residential Properties
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          {fmt(total)} properties — click a slice to drill down
        </p>

        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
              onClick={handlePieClick}
              cursor="pointer"
              stroke="none"
            >
              {donutData.map((entry, i) => (
                <Cell key={entry.name} fill={DONUT_COLORS[i]} opacity={
                  drillDown === null ? 1
                    : (i === 0 && drillDown === "owner_occupied") || (i === 1 && (drillDown === "not_owner_occupied" || drillDown === "entities" || drillDown === "states"))
                      ? 1 : 0.3
                } />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CUSTOM_TOOLTIP_STYLE}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [
                `${fmt(Number(value))} (${pct(Number(value), total)}%)`,
                "",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex justify-center gap-4 text-xs mt-1">
          {donutData.map((d, i) => (
            <button
              key={d.name}
              onClick={() => {
                const keys: DrillDown[] = ["owner_occupied", "not_owner_occupied", null];
                setDrillDown((prev) => (prev === keys[i] ? null : keys[i]));
              }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                drillDown === null || (i === 0 && drillDown === "owner_occupied") || (i === 1 && (drillDown === "not_owner_occupied" || drillDown === "entities" || drillDown === "states"))
                  ? "opacity-100" : "opacity-40"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: DONUT_COLORS[i] }}
              />
              <span className="text-gray-600">
                {d.name}: <strong>{fmt(d.value)}</strong> ({pct(d.value, total)}%)
              </span>
            </button>
          ))}
        </div>
      </div>

      {drillDown === "owner_occupied" && (
        <DrillDownSection title="Owner-Occupied Breakdown" onClose={() => setDrillDown(null)}>
          <p className="text-xs text-gray-400 mb-2">
            How confident are we these are primary residences?
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={ownerOccBars} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#6b7280" }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v: any) => fmt(Number(v))} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {ownerOccBars.map((b) => (
                  <Cell key={b.name} fill={b.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </DrillDownSection>
      )}

      {drillDown === "not_owner_occupied" && (
        <DrillDownSection title="Not Owner-Occupied Breakdown" onClose={() => setDrillDown(null)}>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setDrillDown("entities")}
              className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded hover:bg-purple-100 transition-colors"
            >
              View Entity Types
            </button>
            <button
              onClick={() => setDrillDown("states")}
              className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 transition-colors"
            >
              Top States
            </button>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={notOwnerBars} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "#6b7280" }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip
                contentStyle={CUSTOM_TOOLTIP_STYLE}
                formatter={(v: any) => fmt(Number(v))}
                labelFormatter={(label: any) => {
                  const row = notOwnerBars.find((r) => r.name === String(label));
                  if (!row) return String(label);
                  return `${label} (${fmt(row.value)})`;
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {notOwnerBars.map((b) => (
                  <Cell key={b.name} fill={b.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 text-xs text-gray-400 space-y-0.5">
            {notOwnerOccupied.map((row) => (
              <div key={row.category} className="flex justify-between">
                <span>{row.category}</span>
                <span>
                  {Number(row.entity_owned) > 0 && `${fmt(Number(row.entity_owned))} entity`}
                  {Number(row.has_exemption) > 0 && ` · ${fmt(Number(row.has_exemption))} w/ exemption`}
                </span>
              </div>
            ))}
          </div>
        </DrillDownSection>
      )}

      {drillDown === "entities" && (
        <DrillDownSection
          title="Entity Ownership Types"
          onClose={() => setDrillDown("not_owner_occupied")}
          backLabel="Back to breakdown"
        >
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={entityBars} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#6b7280" }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v: any) => fmt(Number(v))} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {entityBars.map((b) => (
                  <Cell key={b.name} fill={b.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </DrillDownSection>
      )}

      {drillDown === "states" && (
        <DrillDownSection
          title="Top Out-of-State Owners"
          onClose={() => setDrillDown("not_owner_occupied")}
          backLabel="Back to breakdown"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stateBars} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 11, fill: "#6b7280" }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v: any) => fmt(Number(v))} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {stateBars.map((b) => (
                  <Cell key={b.name} fill={b.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </DrillDownSection>
      )}
    </div>
  );
}

function DrillDownSection({
  title,
  onClose,
  backLabel,
  children,
}: {
  title: string;
  onClose: () => void;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-700 text-sm">{title}</h4>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {backLabel ?? "Close"}
        </button>
      </div>
      {children}
    </div>
  );
}
