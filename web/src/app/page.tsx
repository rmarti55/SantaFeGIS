"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import StatsPanel from "@/components/StatsPanel";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Home() {
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col relative">
      {/* Header */}
      <header className="bg-gray-900 text-white px-5 py-3 flex items-center justify-between z-[1001] relative">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Santa Fe Second Home Map</h1>
          <p className="text-xs text-gray-400">Property ownership analysis from Santa Fe County GIS data</p>
        </div>
        <button
          onClick={() => setStatsOpen(!statsOpen)}
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded text-sm transition-colors"
        >
          {statsOpen ? "Close Stats" : "View Stats"}
        </button>
      </header>

      {/* Map + Stats */}
      <div className="flex-1 relative">
        <Map />
        <StatsPanel open={statsOpen} onClose={() => setStatsOpen(false)} />
      </div>
    </div>
  );
}
