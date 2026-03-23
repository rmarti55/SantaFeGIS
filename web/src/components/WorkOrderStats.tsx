"use client";

import { useEffect, useState } from "react";
import {
  PROBLEM_TYPES,
  PROBLEM_TYPE_COLORS,
  STATUS_LABELS,
} from "@/lib/arcgis";

interface Stats {
  total: number;
  avgResolveDays: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export default function WorkOrderStats({
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
    fetch("/api/work-orders/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, stats]);

  if (!open) return null;

  const openCount =
    stats?.byStatus
      .filter((s) => s.status !== "closed" && s.status !== "cs_only_resolved")
      .reduce((sum, s) => sum + s.count, 0) ?? 0;

  const closedCount =
    stats?.byStatus
      .filter((s) => s.status === "closed" || s.status === "cs_only_resolved")
      .reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-[1001] overflow-y-auto border-l border-gray-200">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Work Order Stats</h2>
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
                {stats.total.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Work Orders</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">
                {openCount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Open</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">
                {closedCount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Closed / Resolved</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-600">
                {stats.avgResolveDays}
              </div>
              <div className="text-xs text-gray-500">Avg Days to Resolve</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">By Status</h3>
            <div className="space-y-1.5">
              {stats.byStatus.map((s) => (
                <div key={s.status} className="flex items-center gap-2">
                  <span className="text-sm w-24 text-gray-600 truncate">
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-blue-400 h-full rounded-full"
                      style={{
                        width: `${(s.count / stats.total) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-14 text-right">
                    {s.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">
              By Problem Type
            </h3>
            <div className="space-y-1.5">
              {stats.byType.slice(0, 15).map((t) => {
                const maxCount = stats.byType[0]?.count ?? 1;
                return (
                  <div key={t.type} className="flex items-center gap-2">
                    <span className="text-sm w-28 text-gray-600 truncate">
                      {PROBLEM_TYPES[t.type] ?? t.type}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(t.count / maxCount) * 100}%`,
                          backgroundColor:
                            PROBLEM_TYPE_COLORS[t.type] ?? "#94a3b8",
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-14 text-right">
                      {t.count.toLocaleString()}
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
