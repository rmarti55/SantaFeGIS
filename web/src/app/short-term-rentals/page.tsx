"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import StrDataTable from "@/components/StrDataTable";
import StrOwnershipStats from "@/components/StrOwnershipStats";

const StrMap = dynamic(() => import("@/components/StrMap"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
      Loading map…
    </div>
  ),
});

type Tab = "map" | "table";

export default function ShortTermRentalsPage() {
  const [tab, setTab] = useState<Tab>("map");
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="bg-gray-800 text-white px-5 py-2 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Registered short-term rental permits from the City of Santa Fe GIS
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStatsOpen((v) => !v)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statsOpen
                ? "bg-indigo-500 text-white"
                : "bg-white/10 text-gray-300 hover:text-white"
            }`}
          >
            Ownership Analysis
          </button>
          <nav className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setTab("map")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "map"
                  ? "bg-white text-gray-900"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setTab("table")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "table"
                  ? "bg-white text-gray-900"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Table
            </button>
          </nav>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div className={tab === "map" ? "h-full" : "hidden"}>
          <StrMap />
        </div>
        <div className={tab === "table" ? "h-full" : "hidden"}>
          <StrDataTable />
        </div>
        <StrOwnershipStats
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
        />
      </div>
    </div>
  );
}
