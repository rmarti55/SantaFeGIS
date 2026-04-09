"use client";

import dynamic from "next/dynamic";

const OrgTree = dynamic(() => import("@/components/OrgTree"), { ssr: false });

export default function OrgTreePage() {
  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
      <div className="bg-gray-800 text-white px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide">
          City of Santa Fe &mdash; Organizational Tree
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Hierarchy built from public salary data &amp; FY26 department directors
          &middot; Click any node to expand
        </p>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <OrgTree />
      </div>
    </div>
  );
}
