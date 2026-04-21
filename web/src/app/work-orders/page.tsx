"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import WorkOrderSidebar from "@/components/WorkOrderSidebar";
import type { WorkOrderFilterValues } from "@/components/WorkOrderFilters";
import WorkOrderStats from "@/components/WorkOrderStats";
import WorkOrderTable from "@/components/WorkOrderTable";
import ReportForm from "@/components/ReportForm";

const WorkOrderMap = dynamic(() => import("@/components/WorkOrderMap"), {
  ssr: false,
});

type Tab = "map" | "table" | "explorer" | "report";

export default function WorkOrdersPage() {
  const [tab, setTab] = useState<Tab>("map");
  const [filters, setFilters] = useState<WorkOrderFilterValues>({
    status: "",
    dateRange: "730d",
    problem: "Shopping Carts",
  });
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCountChange = useCallback((n: number) => setCount(n), []);
  const handleLoadingChange = useCallback((l: boolean) => setLoading(l), []);

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="bg-gray-800 text-white px-5 py-2 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Public 311 work orders from the City of Santa Fe CRM system
        </p>
        <nav className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
          {(["map", "table", "explorer", "report"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? t === "report"
                    ? "bg-green-500 text-white"
                    : "bg-white text-gray-900"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              {t === "map" ? "Map" : t === "table" ? "Table" : t === "explorer" ? "Explorer" : "Report a Problem"}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {tab === "map" && (
          <div className="flex h-full">
            <WorkOrderSidebar
              filters={filters}
              onChange={setFilters}
              onRefresh={() => setRefreshKey((k) => k + 1)}
              loading={loading}
              count={count}
            />
            <div className="flex-1 min-w-0">
              <WorkOrderMap
                filters={filters}
                onCountChange={handleCountChange}
                onLoadingChange={handleLoadingChange}
                refreshKey={refreshKey}
              />
            </div>
          </div>
        )}
        <div className={tab === "table" ? "h-full" : "hidden"}>
          <WorkOrderTable />
        </div>
        {tab === "explorer" && <WorkOrderStats />}
        {tab === "report" && (
          <div className="h-full overflow-hidden">
            <ReportForm />
          </div>
        )}
      </div>
    </div>
  );
}
