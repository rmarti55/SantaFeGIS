"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import ZoningFilters from "@/components/ZoningFilters";
import ZoningStats from "@/components/ZoningStats";
import type { ZoningFilterValues } from "@/components/ZoningMap";

const ZoningMap = dynamic(() => import("@/components/ZoningMap"), {
  ssr: false,
});

export default function ZoningPage() {
  const [filters, setFilters] = useState<ZoningFilterValues>({
    category: "",
    viewMode: "simplified",
  });
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [statsOpen, setStatsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCountChange = useCallback((n: number) => setCount(n), []);
  const handleLoadingChange = useCallback((l: boolean) => setLoading(l), []);

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="bg-gray-800 text-white px-5 py-2 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          City of Santa Fe Official Zoning Map
        </p>
        <button
          onClick={() => setStatsOpen(!statsOpen)}
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded text-sm transition-colors"
        >
          {statsOpen ? "Close Stats" : "View Stats"}
        </button>
      </div>

      <ZoningFilters
        filters={filters}
        onChange={setFilters}
        onRefresh={() => setRefreshKey((k) => k + 1)}
        loading={loading}
        count={count}
      />

      <div className="flex-1 relative">
        <ZoningMap
          filters={filters}
          onCountChange={handleCountChange}
          onLoadingChange={handleLoadingChange}
          refreshKey={refreshKey}
        />
        <ZoningStats
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
        />
      </div>
    </div>
  );
}
