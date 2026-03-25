"use client";

import { useEffect, useState } from "react";
import {
  getZoningCategory,
  ZONING_CATEGORY_COLORS,
  getZoningDetailedColor,
  type ZoningCategory,
} from "@/lib/arcgis";

interface Stats {
  total: number;
  byZdesc: { zdesc: string; count: number }[];
}

interface CategoryRow {
  category: ZoningCategory;
  count: number;
  color: string;
}

export default function ZoningStats({
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
    fetch("/api/zoning/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, stats]);

  if (!open) return null;

  const byCategory: CategoryRow[] = [];
  if (stats) {
    const catMap = new Map<ZoningCategory, number>();
    for (const row of stats.byZdesc) {
      const cat = getZoningCategory(row.zdesc);
      catMap.set(cat, (catMap.get(cat) ?? 0) + row.count);
    }
    for (const [category, count] of catMap) {
      byCategory.push({
        category,
        count,
        color: ZONING_CATEGORY_COLORS[category],
      });
    }
    byCategory.sort((a, b) => b.count - a.count);
  }

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-[1001] overflow-y-auto border-l border-gray-200">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">
          Zoning Stats
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
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-800">
              {stats.total.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Total Zoning Parcels</div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">
              By Category
            </h3>
            <div className="space-y-1.5">
              {byCategory.map((row) => {
                const maxCount = byCategory[0]?.count ?? 1;
                return (
                  <div key={row.category} className="flex items-center gap-2">
                    <span className="text-sm w-40 text-gray-600 truncate">
                      {row.category}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.count / maxCount) * 100}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">
              By Zoning Code (Top 20)
            </h3>
            <div className="space-y-1.5">
              {stats.byZdesc.slice(0, 20).map((row) => {
                const maxCount = stats.byZdesc[0]?.count ?? 1;
                return (
                  <div key={row.zdesc} className="flex items-center gap-2">
                    <span className="text-sm w-20 text-gray-600 truncate font-mono">
                      {row.zdesc}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.count / maxCount) * 100}%`,
                          backgroundColor: getZoningDetailedColor(row.zdesc),
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">
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
