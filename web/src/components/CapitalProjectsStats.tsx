"use client";

import { useEffect, useState } from "react";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_COLORS,
  PROJECT_PHASES,
  FUND_SOURCES,
} from "@/lib/arcgis";

interface Stats {
  total: number;
  totalCost: number;
  avgCost: number;
  byType: { type: string; count: number }[];
  byPhase: { phase: string; count: number }[];
  byFunding: { source: string; count: number }[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CapitalProjectsStats({
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
    fetch("/api/capital-projects/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, stats]);

  if (!open) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-[1001] overflow-y-auto border-l border-gray-200">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">
          Capital Projects Stats
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
                {stats.total}
              </div>
              <div className="text-xs text-gray-500">Total Projects</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-indigo-600">
                {formatCurrency(stats.totalCost)}
              </div>
              <div className="text-xs text-gray-500">Total Est. Cost</div>
            </div>
            <div className="col-span-2 bg-amber-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(stats.avgCost)}
              </div>
              <div className="text-xs text-gray-500">Avg. Cost per Project</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">
              By Project Type
            </h3>
            <div className="space-y-1.5">
              {stats.byType.map((t) => {
                const maxCount = stats.byType[0]?.count ?? 1;
                return (
                  <div key={t.type} className="flex items-center gap-2">
                    <span className="text-sm w-32 text-gray-600 truncate">
                      {PROJECT_TYPES[t.type] ?? t.type}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(t.count / maxCount) * 100}%`,
                          backgroundColor:
                            PROJECT_TYPE_COLORS[t.type] ?? "#94a3b8",
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">
                      {t.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">
              By Phase
            </h3>
            <div className="space-y-1.5">
              {stats.byPhase.map((p) => {
                const maxCount = stats.byPhase[0]?.count ?? 1;
                return (
                  <div key={p.phase} className="flex items-center gap-2">
                    <span className="text-sm w-28 text-gray-600 truncate">
                      {PROJECT_PHASES[p.phase] ?? p.phase}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-400"
                        style={{
                          width: `${(p.count / maxCount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">
                      {p.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">
              By Funding Source
            </h3>
            <div className="space-y-1.5">
              {stats.byFunding.map((f) => {
                const maxCount = stats.byFunding[0]?.count ?? 1;
                return (
                  <div key={f.source} className="flex items-center gap-2">
                    <span className="text-sm w-28 text-gray-600 truncate">
                      {FUND_SOURCES[f.source] ?? f.source}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{
                          width: `${(f.count / maxCount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">
                      {f.count}
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
