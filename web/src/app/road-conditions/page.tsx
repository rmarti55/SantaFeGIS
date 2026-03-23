"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import RoadConditionFilters, {
  type RoadConditionFilterValues,
} from "@/components/RoadConditionFilters";
import RoadConditionStats from "@/components/RoadConditionStats";

const RoadConditionMap = dynamic(
  () => import("@/components/RoadConditionMap"),
  { ssr: false }
);

export default function RoadConditionsPage() {
  const [filters, setFilters] = useState<RoadConditionFilterValues>({
    condition: "",
    decade: "",
    colorBy: "age",
    showPriority: false,
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
          City of Santa Fe pavement maintenance history and crew priority
          ratings — 1,460 city road segments
        </p>
        <button
          onClick={() => setStatsOpen(!statsOpen)}
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded text-sm transition-colors"
        >
          {statsOpen ? "Close Stats" : "View Stats"}
        </button>
      </div>

      <RoadConditionFilters
        filters={filters}
        onChange={setFilters}
        onRefresh={() => setRefreshKey((k) => k + 1)}
        loading={loading}
        count={count}
      />

      <div className="flex-1 relative">
        <RoadConditionMap
          filters={filters}
          onCountChange={handleCountChange}
          onLoadingChange={handleLoadingChange}
          refreshKey={refreshKey}
        />
        <RoadConditionStats
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
        />
      </div>
    </div>
  );
}
