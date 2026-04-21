"use client";

import { PROBLEM_TYPES, PROBLEM_TYPE_COLORS } from "@/lib/arcgis";

interface Props {
  problemtype: string;
  description: string;
  details: Record<string, string>;
  lng: number | null;
  lat: number | null;
  addressText: string;
  name: string;
  email: string;
  phone: string;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

export default function StepConfirm({
  problemtype,
  description,
  details,
  lng,
  lat,
  addressText,
  name,
  email,
  phone,
  submitting,
  error,
  onSubmit,
  onBack,
}: Props) {
  const typeLabel = PROBLEM_TYPES[problemtype] ?? problemtype;
  const color = PROBLEM_TYPE_COLORS[problemtype] ?? "#6b7280";

  const detailRows = Object.entries(details).filter(([, v]) => v);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">Review your report</h2>
        <p className="text-gray-500 text-sm mb-6">
          Make sure everything looks right before submitting.
        </p>

        <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
          <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: color + "18" }}>
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="font-bold text-gray-900 text-sm">{typeLabel}</span>
          </div>

          <div className="px-4 py-2">
            {detailRows.map(([key, val]) => (
              <Row
                key={key}
                label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                value={val}
              />
            ))}
            {description && <Row label="Description" value={description} />}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
          <div className="px-4 py-3 bg-gray-50 font-semibold text-xs text-gray-500 uppercase tracking-wide">
            Location
          </div>
          <div className="px-4 py-2">
            {addressText && <Row label="Address" value={addressText} />}
            {lat != null && lng != null && (
              <Row label="Coordinates" value={`${lat.toFixed(5)}, ${lng.toFixed(5)}`} />
            )}
          </div>
        </div>

        {(name || email || phone) && (
          <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
            <div className="px-4 py-3 bg-gray-50 font-semibold text-xs text-gray-500 uppercase tracking-wide">
              Contact
            </div>
            <div className="px-4 py-2">
              {name && <Row label="Name" value={name} />}
              {email && <Row label="Email" value={email} />}
              {phone && <Row label="Phone" value={phone} />}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-100 bg-white">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit Report to City of Santa Fe"
          )}
        </button>
      </div>
    </div>
  );
}
