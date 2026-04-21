"use client";

import dynamic from "next/dynamic";

const ContractsTable = dynamic(() => import("@/components/ContractsTable"), { ssr: false });

export default function ContractsPage() {
  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
      <div className="bg-gray-800 text-white px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide">
          City of Santa Fe &mdash; Contracts
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Public contracts from the Sunshine Portal &middot; Scraped from santafenm.gov &middot; Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <ContractsTable />
      </div>
    </div>
  );
}
