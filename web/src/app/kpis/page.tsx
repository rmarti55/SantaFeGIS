"use client";

import dynamic from "next/dynamic";

const KPIDashboard = dynamic(
  () => import("@/components/KPIDashboard"),
  { ssr: false }
);

export default function KPIsPage() {
  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
      <div className="bg-gray-800 text-white px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide">
          City of Santa Fe — FY26 Departmental Goals, Objectives &amp; KPIs
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          14 departments &middot; Performance-based budgeting per Resolution 2025-58
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
        <KPIDashboard />
      </div>
    </div>
  );
}
