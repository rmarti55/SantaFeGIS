"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import StatsPanel from "@/components/StatsPanel";
import DataTable from "@/components/DataTable";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

type Tab = "map" | "table";

export default function Home() {
  const [tab, setTab] = useState<Tab>("map");
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col relative">
      {/* Header */}
      <header className="bg-gray-900 text-white px-5 py-3 flex items-center justify-between z-[1001] relative">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Santa Fe Second Home Map</h1>
            <p className="text-xs text-gray-400">City of Santa Fe property ownership analysis</p>
          </div>
          <nav className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setTab("map")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "map" ? "bg-white text-gray-900" : "text-gray-300 hover:text-white"
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setTab("table")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "table" ? "bg-white text-gray-900" : "text-gray-300 hover:text-white"
              }`}
            >
              Table
            </button>
          </nav>
        </div>
        <button
          onClick={() => setStatsOpen(!statsOpen)}
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded text-sm transition-colors"
        >
          {statsOpen ? "Close Stats" : "View Stats"}
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        <div className={tab === "map" ? "h-full" : "hidden"}>
          <Map />
        </div>
        <div className={tab === "table" ? "h-full" : "hidden"}>
          <DataTable />
        </div>
        <StatsPanel open={statsOpen} onClose={() => setStatsOpen(false)} />
      </div>
    </div>
  );
}
