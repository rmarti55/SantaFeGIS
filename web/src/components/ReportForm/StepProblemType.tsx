"use client";

import { PROBLEM_TYPES, PROBLEM_TYPE_COLORS } from "@/lib/arcgis";

// Icons per problem type (emoji fallback — simple & no deps)
const PROBLEM_ICONS: Record<string, string> = {
  abandonedvehicle: "🚗",
  arroyoriver: "🌊",
  transit: "🚌",
  encampments: "⛺",
  graffiti: "🎨",
  dumping: "🗑️",
  parking: "🅿️",
  parks: "🌳",
  property: "🏠",
  roads: "🛣️",
  streetlights: "💡",
  trash: "♻️",
  utilities: "🔧",
  weeds: "🌿",
  other: "📋",
};

interface Props {
  onSelect: (type: string) => void;
}

export default function StepProblemType({ onSelect }: Props) {
  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        What are you reporting?
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        Select the category that best describes the issue.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(PROBLEM_TYPES).map(([key, label]) => {
          const color = PROBLEM_TYPE_COLORS[key] ?? "#6b7280";
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="flex flex-col items-start gap-2 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-300 hover:bg-gray-50 active:scale-95 transition-all text-left group"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: color + "22", border: `2px solid ${color}` }}
              >
                {PROBLEM_ICONS[key]}
              </div>
              <span className="text-sm font-semibold text-gray-800 leading-tight">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
