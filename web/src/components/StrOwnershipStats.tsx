"use client";

import { useEffect, useState } from "react";

interface Overview {
  total_str: number;
  matched: number;
  unmatched: number;
  second_home: number;
  not_second_home: number;
  head_of_family: number;
  out_of_state_owner: number;
  in_state_owner: number;
  pct_second_home: number;
  pct_not_second_home: number;
}

interface ScoreBreakdown {
  second_home: number;
  not_second_home: number;
}

interface ByRentalType {
  rental_type: string;
  total: number;
  second_home: number;
  not_second_home: number;
  unmatched: number;
}

interface OwnerState {
  state: string;
  count: number;
}

interface StatsData {
  overview: Overview;
  topOwnerStates: OwnerState[];
  scoreBreakdown: ScoreBreakdown;
  byRentalType: ByRentalType[];
}

function pct(n: number, total: number): string {
  if (!total) return "0";
  return ((n / total) * 100).toFixed(1);
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex-1">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${w}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function StrOwnershipStats({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    fetch("/api/str-ownership/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, data]);

  if (!open) return null;

  const o = data?.overview;
  const sb = data?.scoreBreakdown;
  const maxSb = sb
    ? Math.max(sb.second_home, sb.not_second_home, 1)
    : 1;

  return (
    <div className="absolute top-0 right-0 h-full w-[420px] bg-white shadow-2xl z-[1001] overflow-y-auto border-l border-gray-200">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">
          STR Ownership Analysis
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          &times;
        </button>
      </div>

      {loading && (
        <div className="p-5 text-gray-500 animate-pulse">
          Analyzing ownership data...
        </div>
      )}
      {error && (
        <div className="p-5 text-red-500">Failed to load stats: {error}</div>
      )}

      {o && sb && data && (
        <div className="p-5 space-y-6">
          {/* Headline */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-5 border border-red-100">
            <div className="text-3xl font-bold text-red-600">
              {o.pct_second_home ?? 0}%
            </div>
            <div className="text-sm text-gray-600 mt-1">
              of matched STR permits are on properties flagged as likely second
              homes or investment properties
            </div>
          </div>

          {/* Overview cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card label="Total STR Permits" value={o.total_str} />
            <Card label="Matched to Parcels" value={o.matched} sub={`${pct(o.matched, o.total_str)}%`} />
            <Card label="Second Home" value={o.second_home} color="text-red-600" />
            <Card label="Not Second Home" value={o.not_second_home} color="text-green-600" />
            <Card label="Out-of-State Owner" value={o.out_of_state_owner} color="text-orange-600" />
            <Card label="Head of Family Exemption" value={o.head_of_family} color="text-green-600" />
          </div>

          {/* Score breakdown */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">
              STR Property Classification
            </h3>
            <div className="space-y-2">
              {[
                { label: "Second Home", value: sb.second_home, color: "#ef4444" },
                { label: "Not Second Home", value: sb.not_second_home, color: "#22c55e" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 text-sm">
                  <span className="w-28 text-gray-600 shrink-0">{row.label}</span>
                  <Bar value={row.value} max={maxSb} color={row.color} />
                  <span className="w-10 text-right font-medium text-gray-700">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* By rental type */}
          {data.byRentalType.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">
                By Rental Type
              </h3>
              <div className="space-y-2 text-sm">
                {data.byRentalType.map((r) => (
                  <div
                    key={r.rental_type}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <span className="font-medium text-gray-700">
                      {r.rental_type}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-red-600">
                        {r.second_home} 2nd home
                      </span>
                      <span className="text-green-600">
                        {r.not_second_home} not 2nd
                      </span>
                      {r.unmatched > 0 && (
                        <span className="text-gray-400">
                          {r.unmatched} unmatched
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top owner states */}
          {data.topOwnerStates.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">
                Top Out-of-State Owner Locations
              </h3>
              <div className="space-y-1.5">
                {data.topOwnerStates.map((s, i) => {
                  const maxCount = data.topOwnerStates[0]?.count ?? 1;
                  return (
                    <div key={s.state} className="flex items-center gap-3 text-sm">
                      <span className="w-6 text-gray-400 text-right">{i + 1}.</span>
                      <span className="w-8 font-mono font-medium text-gray-700">
                        {s.state}
                      </span>
                      <Bar value={s.count} max={maxCount} color="#6366f1" />
                      <span className="w-10 text-right text-gray-600">
                        {s.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Methodology note */}
          <div className="text-xs text-gray-400 border-t pt-4">
            STR permits are spatially matched to the nearest Santa Fe County
            parcel record within ~30 meters. Second home scores are based on
            owner mailing address, entity ownership, property value, and
            multi-property ownership signals.
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  color = "text-gray-900",
}: {
  label: string;
  value: number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <div className={`text-xl font-bold ${color}`}>
        {(value ?? 0).toLocaleString()}
        {sub && (
          <span className="text-xs font-normal text-gray-400 ml-1">{sub}</span>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
