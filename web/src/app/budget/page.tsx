"use client";

import dynamic from "next/dynamic";

const BudgetDashboard = dynamic(
  () => import("@/components/BudgetDashboard"),
  { ssr: false }
);

export default function BudgetPage() {
  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
      <div className="bg-gray-800 text-white px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide">
          City of Santa Fe — Adopted FY 2025-26 Budget
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          All Funds: $480.6 million across 20 departments
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
        <BudgetDashboard />
      </div>
    </div>
  );
}
