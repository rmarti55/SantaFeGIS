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
  is_head_of_family: number;
  is_senior_freeze: number;
  neighborhood: string;
  score: number;
  is_likely_second_home: boolean;
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

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
      zoom: 13,
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
    setLoading(true);
    setError(null);

    const bounds = mapRef.current.getBounds();
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    const params = new URLSearchParams({
      bbox,
      minScore: String(filters.minScore),
      maxScore: String(filters.maxScore),
    });
    if (filters.ownerState) params.set("ownerState", filters.ownerState);
    if (filters.propertyClass) params.set("propertyClass", filters.propertyClass);

    try {
      const resp = await fetch(`/api/parcels?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const geojson = await resp.json();

      if (layerRef.current) {
        mapRef.current!.removeLayer(layerRef.current);
      }

      const layer = L.geoJSON(geojson, {
        style: (feature) => ({
          color: scoreColor(feature?.properties?.score ?? 0),
          weight: 1,
          fillOpacity: 0.4,
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
              <div style="margin-top: 6px; color: #6b7280; font-size: 11px;">
                Head of family: ${p.is_head_of_family ? "Yes" : "No"} &middot;
                Senior freeze: ${p.is_senior_freeze ? "Yes" : "No"}
              </div>
            </div>
          `, { maxWidth: 320 });
        },
      });

      layer.addTo(mapRef.current!);
      layerRef.current = layer;
      setCount(geojson.features?.length ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load parcels");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!mapRef.current) return;
    loadParcels();

    const map = mapRef.current;
    map.on("moveend", loadParcels);
    return () => {
      map.off("moveend", loadParcels);
    };
  }, [loadParcels]);

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
