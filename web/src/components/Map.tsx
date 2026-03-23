"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ParcelProperties {
  objectid: number;
  address: string;
  city: string;
  zip: string;
  owner_name: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  property_class: string;
  acreage: string;
  market_value: number;
  assessed_value: number;
  neighborhood: string;
  score: number;
  is_likely_second_home: boolean;
  score_out_of_state: number;
  score_diff_city: number;
  score_entity: number;
  score_high_value: number;
  score_multi_owner: number;
  score_mailing_match: number;
}

interface Filters {
  minScore: number;
  maxScore: number;
  ownerState: string;
  propertyClass: string;
}

function scoreColor(score: number): string {
  if (score >= 6) return "#dc2626";
  if (score >= 4) return "#f97316";
  if (score >= 2) return "#eab308";
  return "#22c55e";
}

function scoreLabel(score: number): string {
  if (score >= 6) return "Very Likely Second Home";
  if (score >= 4) return "Likely Second Home";
  if (score >= 2) return "Possible Second Home";
  return "Likely Primary Residence";
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function scoreBreakdownRows(p: ParcelProperties): string {
  const factors: [string, number][] = [
    ["Out-of-state owner", p.score_out_of_state],
    ["Different NM city", p.score_diff_city],
    ["Entity ownership", p.score_entity],
    ["High property value", p.score_high_value],
    ["Multi-property owner", p.score_multi_owner],
    ["Mailing = situs addr", p.score_mailing_match],
  ];
  return factors
    .filter(([, v]) => v !== 0)
    .map(([label, v]) => {
      const sign = v > 0 ? "+" : "";
      const color = v > 0 ? "#dc2626" : "#16a34a";
      return `<tr><td style="padding:2px 0;color:#374151">${label}</td><td style="text-align:right;padding:2px 0 2px 12px;font-weight:600;color:${color}">${sign}${v}</td></tr>`;
    })
    .join("");
}

const responseCache = new globalThis.Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;

function getCached(key: string) {
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: unknown) {
  responseCache.set(key, { data, ts: Date.now() });
  if (responseCache.size > 50) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
}

export default function ParcelMap() {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastLoadedKeyRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    minScore: 0,
    maxScore: 99,
    ownerState: "",
    propertyClass: "",
  });

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [35.687, -105.938],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const loadParcels = useCallback(async () => {
    if (!mapRef.current) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const map = mapRef.current;
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    const bbox = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;

    const params = new URLSearchParams({
      bbox,
      minScore: String(filters.minScore),
      maxScore: String(filters.maxScore),
      zoom: String(zoom),
    });
    if (filters.ownerState) params.set("ownerState", filters.ownerState);
    if (filters.propertyClass) params.set("propertyClass", filters.propertyClass);

    const cacheKey = params.toString();
    const cached = getCached(cacheKey);

    if (cacheKey === lastLoadedKeyRef.current && layerRef.current) {
      setLoading(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let geojson: any;
      if (cached) {
        geojson = cached;
      } else {
        const resp = await fetch(`/api/parcels?${params}`, { signal: controller.signal });
        if (!resp.ok) throw new Error(`API error: ${resp.status}`);
        geojson = await resp.json();
        setCache(cacheKey, geojson);
      }

      if (controller.signal.aborted) return;

      let openPopupObjectId: number | null = null;
      if (layerRef.current) {
        layerRef.current.eachLayer((l) => {
          if ((l as L.Layer & { isPopupOpen?: () => boolean }).isPopupOpen?.()) {
            const feature = (l as L.Layer & { feature?: { properties?: ParcelProperties } }).feature;
            if (feature?.properties?.objectid != null) {
              openPopupObjectId = feature.properties.objectid;
            }
          }
        });
        map.removeLayer(layerRef.current);
      }

      const layer = L.geoJSON(geojson, {
        style: (feature) => ({
          color: scoreColor(feature?.properties?.score ?? 0),
          weight: zoom >= 16 ? 2 : 1,
          fillOpacity: zoom >= 16 ? 0.5 : 0.35,
          fillColor: scoreColor(feature?.properties?.score ?? 0),
        }),
        onEachFeature: (feature, layer) => {
          const p: ParcelProperties = feature.properties;
          layer.bindPopup(`
            <div style="font-family: system-ui; font-size: 13px; line-height: 1.5; min-width: 240px;">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; color: ${scoreColor(p.score)};">
                ${scoreLabel(p.score)} (Score: ${p.score})
              </div>
              <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">
                <div style="font-weight: 600;">Property</div>
                <div>${p.address || "No address"}</div>
                <div>${p.city || ""} ${p.zip || ""}</div>
                <div style="color: #6b7280;">${p.property_class} &middot; ${p.acreage || "?"} acres</div>
                <div style="color: #6b7280;">${p.neighborhood || ""}</div>
              </div>
              <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">
                <div style="font-weight: 600;">Owner</div>
                <div>${p.owner_name || "Unknown"}</div>
                <div>${p.owner_city || ""}, ${p.owner_state || ""} ${p.owner_zip || ""}</div>
              </div>
              <div>
                <div style="font-weight: 600;">Value</div>
                <div>Market: ${formatCurrency(p.market_value)}</div>
                <div>Assessed: ${formatCurrency(p.assessed_value)}</div>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                <div style="font-weight: 600; margin-bottom: 4px;">Score Breakdown</div>
                <table style="width:100%; font-size: 12px; border-collapse: collapse;">
                  ${scoreBreakdownRows(p) || '<tr><td style="color:#6b7280">No factors detected</td></tr>'}
                  <tr style="border-top: 1px solid #e5e7eb;">
                    <td style="padding:4px 0 0; font-weight:600; color:#374151">Total</td>
                    <td style="text-align:right; padding:4px 0 0 12px; font-weight:700; color:${scoreColor(p.score)}">${p.score}</td>
                  </tr>
                </table>
              </div>
            </div>
          `, { maxWidth: 320 });
        },
      });

      layer.addTo(map);
      layerRef.current = layer;
      lastLoadedKeyRef.current = cacheKey;
      setCount(geojson.features?.length ?? 0);

      if (openPopupObjectId != null) {
        layer.eachLayer((l) => {
          const feature = (l as L.Layer & { feature?: { properties?: ParcelProperties } }).feature;
          if (feature?.properties?.objectid === openPopupObjectId) {
            (l as L.Layer & { openPopup: () => void }).openPopup();
          }
        });
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load parcels");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filters]);

  const debouncedLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadParcels, 400);
  }, [loadParcels]);

  useEffect(() => {
    if (!mapRef.current) return;
    loadParcels();

    const map = mapRef.current;
    map.on("moveend", debouncedLoad);
    return () => {
      map.off("moveend", debouncedLoad);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadParcels, debouncedLoad]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm z-[1000] relative">
        <div className="font-semibold text-gray-700 mr-2">Filters:</div>

        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Min Score</span>
          <select
            className="border rounded px-2 py-1 text-gray-800 bg-white"
            value={filters.minScore}
            onChange={(e) => setFilters((f) => ({ ...f, minScore: +e.target.value }))}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Owner State</span>
          <input
            type="text"
            maxLength={2}
            placeholder="e.g. TX"
            className="border rounded px-2 py-1 w-16 uppercase text-gray-800 bg-white"
            value={filters.ownerState}
            onChange={(e) => setFilters((f) => ({ ...f, ownerState: e.target.value.toUpperCase() }))}
          />
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Class</span>
          <select
            className="border rounded px-2 py-1 text-gray-800 bg-white"
            value={filters.propertyClass}
            onChange={(e) => setFilters((f) => ({ ...f, propertyClass: e.target.value }))}
          >
            <option value="">All</option>
            <option value="SRES">SRES (Single Res)</option>
            <option value="MRES">MRES (Multi Res)</option>
            <option value="CRES">CRES (Condo Res)</option>
            <option value="COMM">COMM (Commercial)</option>
            <option value="VAC">VAC (Vacant)</option>
          </select>
        </label>

        <button
          onClick={loadParcels}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>

        <div className="ml-auto flex items-center gap-3 text-gray-500">
          {loading && <span className="animate-pulse">Loading...</span>}
          {!loading && <span>{count.toLocaleString()} parcels</span>}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg px-4 py-3 z-[1000] text-xs">
        <div className="font-semibold text-gray-700 mb-2">Second Home Likelihood</div>
        {[
          { color: "#dc2626", label: "Very Likely (6+)" },
          { color: "#f97316", label: "Likely (4-5)" },
          { color: "#eab308", label: "Possible (2-3)" },
          { color: "#22c55e", label: "Primary (0-1)" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 mb-1">
            <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: color, opacity: 0.7 }} />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Map container */}
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
