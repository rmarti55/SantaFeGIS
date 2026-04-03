"use client";

import dynamic from "next/dynamic";

const SalaryTable = dynamic(() => import("@/components/SalaryTable"), {
  ssr: false,
});

export default function SalariesPage() {
  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
      <div className="bg-gray-800 text-white px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide">
          City of Santa Fe &mdash; Employee Salaries &amp; Positions
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Public employee compensation data scraped from santafenm.gov &middot;
          Updated March 30, 2026
        </p>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <SalaryTable />
      </div>
    </div>
  );
}
