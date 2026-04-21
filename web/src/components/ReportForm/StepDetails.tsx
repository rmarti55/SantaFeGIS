"use client";

import { PROBLEM_TYPES } from "@/lib/arcgis";

interface Field {
  key: string;
  label: string;
  type: "text" | "select" | "textarea";
  options?: string[];
  placeholder?: string;
}

const DETAIL_FIELDS: Record<string, Field[]> = {
  abandonedvehicle: [
    { key: "licenseplate", label: "License Plate", type: "text", placeholder: "ABC-1234" },
    { key: "makemodel", label: "Make & Model", type: "text", placeholder: "e.g. Honda Civic" },
    { key: "vehiclecolor", label: "Color", type: "text", placeholder: "e.g. Silver" },
  ],
  encampments: [
    { key: "camplocation", label: "Where is the encampment?", type: "text", placeholder: "e.g. Under the bridge at Paseo" },
    { key: "campnumber", label: "Estimated number of people", type: "text", placeholder: "e.g. 3-5" },
    { key: "campactive", label: "Currently active?", type: "select", options: ["Yes", "No", "Unknown"] },
    { key: "campobjects", label: "Items present (tents, furniture, etc.)", type: "text", placeholder: "e.g. 2 tents, shopping carts" },
  ],
  dumping: [
    {
      key: "dumping",
      label: "What was dumped?",
      type: "select",
      options: [
        "Furniture (couch, mattress, box springs, etc.)",
        "Construction materials",
        "Tires",
        "Appliances",
        "Trash bags",
        "Shopping Carts",
        "Other",
      ],
    },
  ],
  roads: [
    {
      key: "problem2",
      label: "Type of road issue",
      type: "select",
      options: [
        "Pothole",
        "Sidewalk or curb repair",
        "Signage",
        "Drainage / Culvert",
        "Street grading",
        "Traffic signal or light",
        "Speed / Racing concern",
        "Other",
      ],
    },
    { key: "potholesize", label: "Pothole size (if applicable)", type: "select", options: ["Small (< 6 in)", "Medium (6–18 in)", "Large (> 18 in)"] },
  ],
  streetlights: [
    {
      key: "street_lights",
      label: "Light type",
      type: "select",
      options: ["City-owned street light", "PNM overhead light", "Unknown"],
    },
  ],
  trash: [
    { key: "trash_or_recycling", label: "Trash or recycling?", type: "select", options: ["Trash", "Recycling", "Both"] },
    {
      key: "problem2",
      label: "Issue type",
      type: "select",
      options: [
        "Missed trash or recycling pickup",
        "Trash or recycling receptacle repair or replacement",
        "Overflowing public trash can",
        "Other",
      ],
    },
    { key: "trash_commercial_or_private", label: "Residential or commercial?", type: "select", options: ["Residential", "Commercial"] },
  ],
  weeds: [
    { key: "weeds_height", label: "Approximate height", type: "select", options: ["Under 6 inches", "6–12 inches", "Over 12 inches"] },
    { key: "weeds_vis", label: "Obstructing sidewalk or visibility?", type: "select", options: ["Yes", "No"] },
  ],
  utilities: [
    {
      key: "problem2",
      label: "Utility type",
      type: "select",
      options: [
        "Fire hydrant",
        "Water meter or sewer cover",
        "Water leak or shut-off",
        "Wastewater",
        "Stormwater drain",
        "PNM / Electrical",
        "Other",
      ],
    },
  ],
  property: [
    {
      key: "problem2",
      label: "Issue type",
      type: "select",
      options: [
        "Loud Noise",
        "Nuisance or blighted property",
        "Construction/building without a permit",
        "Short-term rental property complaints",
        "Outdoor Lighting",
        "Animal welfare check",
        "Other",
      ],
    },
  ],
  parks: [
    {
      key: "problem2",
      label: "Issue type",
      type: "select",
      options: [
        "Broken equipment (playground, bench, etc.)",
        "Weeds in park or playground",
        "Graffiti in park, playground, trail, or open space",
        "Refill dog bags / request dog receptacle station",
        "Other",
      ],
    },
  ],
  transit: [
    { key: "transit_routenumber", label: "Route number", type: "text", placeholder: "e.g. 2" },
    { key: "transit_busnumber", label: "Bus number (if visible)", type: "text", placeholder: "e.g. 401" },
    { key: "transit_direction", label: "Direction / destination", type: "text", placeholder: "e.g. Northbound toward Airport" },
    { key: "transit_time", label: "Approximate time of incident", type: "text", placeholder: "e.g. 8:15am" },
  ],
};

interface Props {
  problemtype: string;
  details: Record<string, string>;
  description: string;
  onDetailsChange: (key: string, value: string) => void;
  onDescriptionChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepDetails({
  problemtype,
  details,
  description,
  onDetailsChange,
  onDescriptionChange,
  onNext,
  onBack,
}: Props) {
  const fields = DETAIL_FIELDS[problemtype] ?? [];
  const typeLabel = PROBLEM_TYPES[problemtype] ?? problemtype;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {typeLabel}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Tell us more about the issue.
        </p>

        <div className="space-y-5">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {field.label}
              </label>
              {field.type === "select" ? (
                <select
                  value={details[field.key] ?? ""}
                  onChange={(e) => onDetailsChange(field.key, e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select…</option>
                  {field.options!.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={details[field.key] ?? ""}
                  onChange={(e) => onDetailsChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          ))}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Describe the problem{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Any additional details that would help the city address this issue…"
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 bg-white">
        <button
          onClick={onNext}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all"
        >
          Next: Add Location
        </button>
      </div>
    </div>
  );
}
