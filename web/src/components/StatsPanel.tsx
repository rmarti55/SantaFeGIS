"use client";

import { useEffect, useState } from "react";
import OccupancyCharts from "./OccupancyCharts";

interface Stats {
  summary: {
    total_parcels: number;
    total_residential: number;
    second_homes: number;
    avg_value_second_home: number;
    avg_value_primary: number;
  };
  topOwnerStates: { state: string; count: number }[];
  neighborhoodBreakdown: { neighborhood: string; total: number; second_homes: number; pct: number }[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
}

export default function StatsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || stats) return;
    setLoading(true);
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, stats]);

  if (!open) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-[1001] overflow-y-auto border-l border-gray-200">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Santa Fe Stats</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      {loading && <div className="p-5 text-gray-500 animate-pulse">Loading statistics...</div>}

      <div className="p-5 border-b border-gray-200">
        <OccupancyCharts />
      </div>

      {stats && (
        <div className="p-5 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800">{stats.summary.total_residential?.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Residential Parcels</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">{stats.summary.second_homes?.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Second Homes</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{((stats.summary.total_residential ?? 0) - (stats.summary.second_homes ?? 0)).toLocaleString()}</div>
              <div className="text-xs text-gray-500">Not Second Homes</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">
                {stats.summary.total_residential
                  ? ((stats.summary.second_homes / stats.summary.total_residential) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-xs text-gray-500">Second Home Rate</div>
            </div>
          </div>

          {/* Value comparison */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Avg Market Value</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Second Homes</span>
                <span className="font-semibold text-red-600">{formatCurrency(stats.summary.avg_value_second_home)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Primary Residences</span>
                <span className="font-semibold text-green-600">{formatCurrency(stats.summary.avg_value_primary)}</span>
              </div>
            </div>
          </div>

          {/* Top owner states */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Top Out-of-State Owners</h3>
            <div className="space-y-1.5">
              {stats.topOwnerStates.map((s) => (
                <div key={s.state} className="flex items-center gap-2">
                  <span className="text-sm font-mono w-8 text-gray-600">{s.state}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-red-400 h-full rounded-full"
                      style={{ width: `${(s.count / stats.topOwnerStates[0].count) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Neighborhoods */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Neighborhoods by Second Home %</h3>
            <div className="space-y-1">
              {stats.neighborhoodBreakdown.map((n) => (
                <div key={n.neighborhood} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 truncate flex-1 mr-2">{n.neighborhood}</span>
                  <span className="text-gray-500 text-xs mr-2">{n.second_homes}/{n.total}</span>
                  <span className="font-semibold text-gray-800 w-12 text-right">{n.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
