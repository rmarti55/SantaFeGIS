"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

interface StrProperties {
  id: number;
  source: string;
  address: string | null;
  match_addr: string | null;
  business_license: string | null;
  business_name: string | null;
  dba: string | null;
  status: string | null;
  license_type: string | null;
  rental_type: string | null;
  zoning: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  owner_name: string | null;
  owner_city: string | null;
  owner_state: string | null;
  is_head_of_family: number | null;
  second_home_score: number | null;
  is_likely_second_home: boolean | null;
  parcel_matched: boolean;
}

interface Filters {
  status: string;
  rentalType: string;
}

type ColorMode = "rental_type" | "ownership";
type ViewMode = "markers" | "heatmap";

const RENTAL_TYPE_COLORS: Record<string, string> = {
  Residential: "#3b82f6",
  "Residential Unit": "#3b82f6",
  "Non-Residential": "#8b5cf6",
};

function markerColor(rentalType: string | null): string {
  if (!rentalType) return "#94a3b8";
  return RENTAL_TYPE_COLORS[rentalType] ?? "#94a3b8";
}

function ownershipColor(p: StrProperties): string {
  if (!p.parcel_matched) return "#94a3b8";
  if (p.is_likely_second_home) return "#ef4444";
  if (p.second_home_score != null && p.second_home_score >= 2) return "#f59e0b";
  return "#22c55e";
}

function ownershipLabel(p: StrProperties): string {
  if (!p.parcel_matched) return "No parcel match";
  if (p.is_likely_second_home) return "Likely Second Home";
  if (p.second_home_score != null && p.second_home_score >= 2) return "Possible Second Home";
  return "Likely Primary Residence";
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/A";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

const HEAT_GRADIENT = {
  0.0: "#22c55e",
  0.3: "#84cc16",
  0.5: "#eab308",
  0.7: "#f97316",
  1.0: "#dc2626",
};

export default function StrMap() {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const geojsonCacheRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("markers");
  const [colorMode, setColorMode] = useState<ColorMode>("ownership");
  const [filters, setFilters] = useState<Filters>({
    status: "",
    rentalType: "",
  });

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [35.687, -105.938],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const renderMarkers = useCallback(
    (geojson: GeoJSON.FeatureCollection, cMode: ColorMode) => {
      if (!mapRef.current || !markersRef.current) return;

      markersRef.current.clearLayers();

      L.geoJSON(geojson, {
        pointToLayer: (_feature, latlng) => {
          const p = _feature.properties as StrProperties;
          const fill =
            cMode === "ownership"
              ? ownershipColor(p)
              : markerColor(p.rental_type);
          return L.circleMarker(latlng, {
            radius: 7,
            fillColor: fill,
            color: "#fff",
            weight: 1.5,
            fillOpacity: 0.85,
          });
        },
        onEachFeature: (feature, layer) => {
          const p: StrProperties = feature.properties as StrProperties;
          const displayAddr = p.match_addr || p.address || "No address";
          const ownerBlock = p.parcel_matched
            ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb;">
                <div style="font-weight:600;font-size:12px;color:${ownershipColor(p)};margin-bottom:2px;">
                  ${ownershipLabel(p)}${p.second_home_score != null ? ` (Score: ${p.second_home_score})` : ""}
                </div>
                <div><strong>Owner:</strong> ${p.owner_name || "N/A"}</div>
                <div><strong>Owner Location:</strong> ${[p.owner_city, p.owner_state].filter(Boolean).join(", ") || "N/A"}</div>
                ${p.is_head_of_family === 1 ? '<div style="color:#22c55e;font-size:11px;">Head of Family exemption claimed</div>' : ""}
              </div>`
            : `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb;color:#94a3b8;font-size:12px;">
                No matching parcel record found
              </div>`;
          layer.bindPopup(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:240px;">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:${cMode === "ownership" ? ownershipColor(p) : markerColor(p.rental_type)};">
                ${displayAddr}
              </div>
              ${p.business_name ? `<div style="margin-bottom:6px;"><strong>${p.business_name}</strong>${p.dba && p.dba.trim() ? ` <span style="color:#6b7280;">DBA: ${p.dba}</span>` : ""}</div>` : ""}
              <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">
                <div><strong>License:</strong> ${p.business_license || "N/A"}</div>
                <div><strong>Type:</strong> ${p.rental_type || "N/A"}</div>
                <div><strong>Status:</strong> ${p.status || "N/A"}</div>
                ${p.zoning ? `<div><strong>Zoning:</strong> ${p.zoning}</div>` : ""}
              </div>
              <div style="color:#6b7280;font-size:12px;">
                <div><strong>Issued:</strong> ${formatDate(p.issue_date)}</div>
                <div><strong>Expires:</strong> ${formatDate(p.expiration_date)}</div>
              </div>
              ${ownerBlock}
            </div>`,
            { maxWidth: 340 }
          );
        },
      }).addTo(markersRef.current);
    },
    []
  );

  const renderHeatmap = useCallback(
    (geojson: GeoJSON.FeatureCollection) => {
      if (!mapRef.current) return;

      if (heatRef.current) {
        mapRef.current.removeLayer(heatRef.current);
        heatRef.current = null;
      }

      const points: [number, number, number][] = geojson.features
        .filter((f) => f.geometry.type === "Point")
        .map((f) => {
          const coords = (f.geometry as GeoJSON.Point).coordinates;
          return [coords[1], coords[0], 1] as [number, number, number];
        });

      if (points.length === 0) return;

      heatRef.current = L.heatLayer(points, {
        radius: 25,
        blur: 20,
        maxZoom: 17,
        minOpacity: 0.3,
        gradient: HEAT_GRADIENT,
      }).addTo(mapRef.current);
    },
    []
  );

  const applyView = useCallback(
    (geojson: GeoJSON.FeatureCollection, mode: ViewMode, cMode: ColorMode) => {
      if (!mapRef.current) return;

      if (heatRef.current) {
        mapRef.current.removeLayer(heatRef.current);
        heatRef.current = null;
      }
      if (markersRef.current) {
        markersRef.current.clearLayers();
      }

      if (mode === "heatmap") {
        renderHeatmap(geojson);
      } else {
        renderMarkers(geojson, cMode);
      }
    },
    [renderMarkers, renderHeatmap]
  );

  const loadData = useCallback(async () => {
    if (!mapRef.current || !markersRef.current) return;
    setLoading(true);
    setError(null);

    const bounds = mapRef.current.getBounds();
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    const params = new URLSearchParams({ bbox });
    if (filters.status) params.set("status", filters.status);
    if (filters.rentalType) params.set("rentalType", filters.rentalType);

    try {
      const resp = await fetch(`/api/str?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const geojson = await resp.json();

      geojsonCacheRef.current = geojson;
      applyView(geojson, viewMode, colorMode);
      setCount(geojson.features?.length ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load STR data");
    } finally {
      setLoading(false);
    }
  }, [filters, viewMode, colorMode, applyView]);

  useEffect(() => {
    if (geojsonCacheRef.current) {
      applyView(geojsonCacheRef.current, viewMode, colorMode);
    }
  }, [viewMode, colorMode, applyView]);

  useEffect(() => {
    if (!mapRef.current) return;
    loadData();

    const map = mapRef.current;
    map.on("moveend", loadData);
    return () => {
      map.off("moveend", loadData);
    };
  }, [loadData]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm z-[1000] relative">
        <div className="font-semibold text-gray-700 mr-2">Filters:</div>

        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Status</span>
          <select
            className="border rounded px-2 py-1 text-gray-800 bg-white"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value }))
            }
          >
            <option value="">All</option>
            <option value="Active">Active</option>
            <option value="M">Renewed (M)</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Rental Type</span>
          <select
            className="border rounded px-2 py-1 text-gray-800 bg-white"
            value={filters.rentalType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, rentalType: e.target.value }))
            }
          >
            <option value="">All</option>
            <option value="Residential">Residential</option>
            <option value="Residential Unit">Residential Unit</option>
            <option value="Non-Residential">Non-Residential</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">Color by</span>
          <select
            className="border rounded px-2 py-1 text-gray-800 bg-white"
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value as ColorMode)}
          >
            <option value="ownership">Ownership</option>
            <option value="rental_type">Rental Type</option>
          </select>
        </label>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("markers")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "markers"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Markers
          </button>
          <button
            onClick={() => setViewMode("heatmap")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "heatmap"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Density
          </button>
        </div>

        <button
          onClick={loadData}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>

        <div className="ml-auto flex items-center gap-3 text-gray-500">
          {loading && <span className="animate-pulse">Loading...</span>}
          {!loading && <span>{count.toLocaleString()} rentals</span>}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg px-4 py-3 z-[1000] text-xs">
        {viewMode === "heatmap" ? (
          <>
            <div className="font-semibold text-gray-700 mb-2">
              STR Density
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-24 h-3 rounded"
                style={{
                  background:
                    "linear-gradient(to right, #22c55e, #84cc16, #eab308, #f97316, #dc2626)",
                }}
              />
            </div>
            <div className="flex justify-between text-gray-500 w-24">
              <span>Low</span>
              <span>High</span>
            </div>
          </>
        ) : colorMode === "ownership" ? (
          <>
            <div className="font-semibold text-gray-700 mb-2">Owner Status</div>
            {[
              { color: "#22c55e", label: "Likely Primary Residence" },
              { color: "#f59e0b", label: "Possible Second Home" },
              { color: "#ef4444", label: "Likely Second Home" },
              { color: "#94a3b8", label: "No Parcel Match" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-600">{label}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="font-semibold text-gray-700 mb-2">Rental Type</div>
            {[
              { color: "#3b82f6", label: "Residential" },
              { color: "#8b5cf6", label: "Non-Residential" },
              { color: "#94a3b8", label: "Unknown" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-600">{label}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Map container */}
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
