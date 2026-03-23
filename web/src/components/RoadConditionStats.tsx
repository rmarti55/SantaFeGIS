"use client";

import { useEffect, useState } from "react";
import {
  ROAD_CONDITIONS,
  ROAD_CONDITION_COLORS,
  MAINTENANCE_PRIORITY,
  MAINTENANCE_PRIORITY_COLORS,
} from "@/lib/arcgis";

interface StatsRow {
  key: string;
  count: number;
  miles: number;
}

interface Stats {
  totalSegments: number;
  totalMiles: number;
  byCondition: StatsRow[];
  byDecade: StatsRow[];
  byPriority: StatsRow[];
  oldRoads: { count: number; miles: number };
}

export default function RoadConditionStats({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || stats) return;
    setLoading(true);
    fetch("/api/road-conditions/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, stats]);

  if (!open) return null;

  const priorityCount =
    stats?.byPriority
      .filter((p) => p.key !== "0" && p.key !== "(blank)")
      .reduce((s, p) => s + p.count, 0) ?? 0;

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-[1001] overflow-y-auto border-l border-gray-200">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">
          City Road Stats
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          &times;
        </button>
      </div>

      {loading && (
        <div className="p-5 text-gray-500 animate-pulse">
          Loading statistics...
        </div>
      )}

      {stats && (
        <div className="p-5 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800">
                {stats.totalSegments.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">City Road Segments</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalMiles.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Miles</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">
                {stats.oldRoads.count.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Not Repaved in 15+ yrs</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">
                {stats.oldRoads.miles.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Miles (15+ yrs old)</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">By Condition</h3>
            <div className="space-y-1.5">
              {stats.byCondition.map((row) => {
                const maxCount = stats.byCondition[0]?.count ?? 1;
                const label = ROAD_CONDITIONS[row.key] ?? row.key;
                const color = ROAD_CONDITION_COLORS[row.key] ?? "#94a3b8";
                return (
                  <div key={row.key} className="flex items-center gap-2">
                    <span className="text-sm w-24 text-gray-600 truncate">
                      {label}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.count / maxCount) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">
              By Repave Decade
            </h3>
            <div className="space-y-1.5">
              {stats.byDecade.map((row) => {
                const maxCount = stats.byDecade[0]?.count ?? 1;
                const decadeColors: Record<string, string> = {
                  "2010s": "#22c55e",
                  "2000s": "#eab308",
                  "1990s": "#ef4444",
                  Unknown: "#9ca3af",
                };
                return (
                  <div key={row.key} className="flex items-center gap-2">
                    <span className="text-sm w-20 text-gray-600 truncate">
                      {row.key}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.count / maxCount) * 100}%`,
                          backgroundColor: decadeColors[row.key] ?? "#94a3b8",
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">
              Maintenance Crew Priority
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              {priorityCount} roads flagged for maintenance
            </p>
            <div className="space-y-1.5">
              {stats.byPriority
                .filter((row) => row.key !== "(blank)")
                .map((row) => {
                  const maxCount = stats.byPriority[0]?.count ?? 1;
                  const pri = parseInt(row.key, 10);
                  const label = MAINTENANCE_PRIORITY[pri] ?? `Priority ${row.key}`;
                  const color = MAINTENANCE_PRIORITY_COLORS[pri] ?? "#94a3b8";
                  return (
                    <div key={row.key} className="flex items-center gap-2">
                      <span className="text-sm w-20 text-gray-600 truncate">
                        {label}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(row.count / maxCount) * 100}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">
                        {row.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
