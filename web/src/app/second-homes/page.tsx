"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import StatsPanel from "@/components/StatsPanel";

const ParcelMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
      Loading map…
    </div>
  ),
});

export default function SecondHomesPage() {
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="bg-gray-800 text-white px-5 py-2 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Property ownership analysis from Santa Fe County GIS data
        </p>
        <button
          onClick={() => setStatsOpen(!statsOpen)}
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded text-sm transition-colors"
        >
          {statsOpen ? "Close Stats" : "View Stats"}
        </button>
      </div>

      <div className="flex-1 relative">
        <ParcelMap />
        <StatsPanel open={statsOpen} onClose={() => setStatsOpen(false)} />
      </div>
    </div>
  );
}
