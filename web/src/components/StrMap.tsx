"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { formatOwnerName } from "@/lib/formatOwnerName";

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
  is_second_home: boolean | null;
  parcel_matched: boolean;
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
  if (p.is_second_home) return "#ef4444";
  return "#22c55e";
}

function ownershipLabel(p: StrProperties): string {
  if (!p.parcel_matched) return "No parcel match";
  if (p.is_second_home) return "Second Home";
  return "Not a Second Home";
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

const HISTORIC_DISTRICT_COLORS: Record<string, string> = {
  "Don Gaspar Area HD": "#ffb8c1",
  "Downtown And Eastside HD": "#ffe3b3",
  "Historic Review HD": "#bdeeff",
  "Historic Transition HD": "#c2ffc2",
  "Westside-Guadalupe HD": "#b9d3ee",
};

const HISTORIC_DISTRICT_LABELS: { color: string; label: string }[] = [
  { color: "#ffb8c1", label: "Don Gaspar Area" },
  { color: "#ffe3b3", label: "Downtown & Eastside" },
  { color: "#bdeeff", label: "Historic Review" },
  { color: "#c2ffc2", label: "Historic Transition" },
  { color: "#b9d3ee", label: "Westside-Guadalupe" },
];

export default function StrMap() {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const geojsonCacheRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const historicLayerRef = useRef<L.GeoJSON | null>(null);
  const historicDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("markers");
  const [colorMode, setColorMode] = useState<ColorMode>("ownership");
  const [showHistoricDistricts, setShowHistoricDistricts] = useState(false);

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
                <div><strong>Owner:</strong> ${formatOwnerName(p.owner_name)}</div>
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
  }, [viewMode, colorMode, applyView]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!showHistoricDistricts) {
      if (historicLayerRef.current) {
        map.removeLayer(historicLayerRef.current);
        historicLayerRef.current = null;
      }
      return;
    }

    function addLayer(data: GeoJSON.FeatureCollection) {
      if (!map) return;
      if (historicLayerRef.current) {
        map.removeLayer(historicLayerRef.current);
      }
      historicLayerRef.current = L.geoJSON(data, {
        style: (feature) => {
          const name = feature?.properties?.HDSTNAM ?? "";
          return {
            fillColor: HISTORIC_DISTRICT_COLORS[name] ?? "#6b7280",
            fillOpacity: 0.35,
            color: "#6b7280",
            weight: 2,
            dashArray: "6 4",
          };
        },
        onEachFeature: (_feature, layer) => {
          const name = _feature.properties?.HDSTNAM ?? "Historic District";
          layer.bindTooltip(name, {
            sticky: true,
            className: "historic-district-tooltip",
          });
        },
      }).addTo(map);
      historicLayerRef.current.bringToBack();
    }

    if (historicDataRef.current) {
      addLayer(historicDataRef.current);
      return;
    }

    fetch("/api/historic-districts")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((geojson: GeoJSON.FeatureCollection) => {
        historicDataRef.current = geojson;
        if (showHistoricDistricts) addLayer(geojson);
      })
      .catch(() => {
        /* silently ignore — overlay is optional */
      });
  }, [showHistoricDistricts]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm z-[1000] relative">
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

        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showHistoricDistricts}
            onChange={(e) => setShowHistoricDistricts(e.target.checked)}
            className="accent-indigo-600 w-3.5 h-3.5"
          />
          <span className="text-gray-600">Historic Districts</span>
        </label>

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
              { color: "#ef4444", label: "Second Home" },
              { color: "#22c55e", label: "Not a Second Home" },
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

        {showHistoricDistricts && (
          <>
            <div className="border-t border-gray-200 mt-2 pt-2">
              <div className="font-semibold text-gray-700 mb-1.5">Historic Districts</div>
              {HISTORIC_DISTRICT_LABELS.map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 mb-1">
                  <span
                    className="w-3.5 h-2.5 rounded-sm inline-block shrink-0 border border-gray-400"
                    style={{ backgroundColor: color, opacity: 0.7 }}
                  />
                  <span className="text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Map container */}
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
