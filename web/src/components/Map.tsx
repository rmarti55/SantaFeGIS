"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatOwnerName } from "@/lib/formatOwnerName";

type ViewMode = "parcels" | "density";

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
  is_second_home: boolean;
  score_out_of_state: number;
  score_diff_city: number;
  score_entity: number;
  score_high_value: number;
  score_multi_owner: number;
  score_mailing_match: number;
}

function classColor(isSecondHome: boolean): string {
  return isSecondHome ? "#dc2626" : "#22c55e";
}

function classLabel(isSecondHome: boolean): string {
  return isSecondHome ? "Second Home" : "Not a Second Home";
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

function buildPopupHtml(p: ParcelProperties): string {
  return `
    <div style="font-family: system-ui; font-size: 13px; line-height: 1.5; min-width: 240px;">
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; color: ${classColor(p.is_second_home)};">
        ${classLabel(p.is_second_home)}
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
        <div>${formatOwnerName(p.owner_name)}</div>
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
            <td style="text-align:right; padding:4px 0 0 12px; font-weight:700; color:${classColor(p.is_second_home)}">${p.score}</td>
          </tr>
        </table>
      </div>
    </div>`;
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

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export default function ParcelMap() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastLoadedKeyRef = useRef<string | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const sourceReadyRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("parcels");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [-105.938, 35.687],
      zoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("parcels", { type: "geojson", data: EMPTY_GEOJSON });
      map.addSource("heatpoints", { type: "geojson", data: EMPTY_GEOJSON });

      map.addLayer({
        id: "parcels-fill",
        type: "fill",
        source: "parcels",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "is_second_home"], true], "#dc2626",
            "#22c55e",
          ],
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.35, 16, 0.5],
        },
      });

      map.addLayer({
        id: "parcels-outline",
        type: "line",
        source: "parcels",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "is_second_home"], true], "#dc2626",
            "#22c55e",
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.5, 16, 2],
        },
      });

      map.addLayer({
        id: "heatmap",
        type: "heatmap",
        source: "heatpoints",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["coalesce", ["get", "score"], 0], 0, 0.05, 4, 0.5, 8, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 13, 1.0, 15, 0.6, 17, 0.3],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 8, 13, 15, 15, 10, 17, 4],
          "heatmap-opacity": 0.7,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(34,197,94,0)",
            0.3, "#22c55e",
            0.55, "#eab308",
            0.85, "#f97316",
            1, "#dc2626",
          ],
        },
        layout: { visibility: "none" },
      });

      sourceReadyRef.current = true;
    });

    map.on("click", "parcels-fill", (e) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as ParcelProperties;
      if (!p.address && !p.owner_name) return;

      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new maplibregl.Popup({ maxWidth: "340px" })
        .setLngLat(e.lngLat)
        .setHTML(buildPopupHtml(p))
        .addTo(map);
    });

    map.on("mouseenter", "parcels-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "parcels-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      sourceReadyRef.current = false;
    };
  }, []);

  const loadParcels = useCallback(async (mode: ViewMode) => {
    const map = mapRef.current;
    if (!map || !sourceReadyRef.current) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const zoom = Math.round(map.getZoom());
    const bounds = map.getBounds();
    const bbox = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;

    const wantHeat = mode === "density";
    const params = new URLSearchParams({
      bbox,
      zoom: String(zoom),
      ...(wantHeat ? { mode: "heat" } : {}),
    });

    const cacheKey = params.toString();

    if (cacheKey === lastLoadedKeyRef.current) {
      setLoading(false);
      return;
    }

    try {
      const cached = getCached(cacheKey);
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

      const isHeat = geojson.mode === "heat" || wantHeat;

      if (isHeat) {
        (map.getSource("heatpoints") as maplibregl.GeoJSONSource).setData(geojson);
        (map.getSource("parcels") as maplibregl.GeoJSONSource).setData(EMPTY_GEOJSON);
        map.setLayoutProperty("heatmap", "visibility", "visible");
        map.setLayoutProperty("parcels-fill", "visibility", "none");
        map.setLayoutProperty("parcels-outline", "visibility", "none");
      } else {
        (map.getSource("parcels") as maplibregl.GeoJSONSource).setData(geojson);
        (map.getSource("heatpoints") as maplibregl.GeoJSONSource).setData(EMPTY_GEOJSON);
        map.setLayoutProperty("heatmap", "visibility", "none");
        map.setLayoutProperty("parcels-fill", "visibility", "visible");
        map.setLayoutProperty("parcels-outline", "visibility", "visible");
      }

      lastLoadedKeyRef.current = cacheKey;
      setCount(geojson.features?.length ?? 0);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load parcels");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const debouncedLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadParcels(viewModeRef.current), 400);
  }, [loadParcels]);

  useEffect(() => {
    if (!mapRef.current || !sourceReadyRef.current) return;
    lastLoadedKeyRef.current = null;
    loadParcels(viewMode);
  }, [viewMode, loadParcels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.on("moveend", debouncedLoad);
    return () => {
      map.off("moveend", debouncedLoad);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debouncedLoad]);

  // Trigger initial load once map style is ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onStyleLoad = () => {
      if (sourceReadyRef.current) loadParcels(viewModeRef.current);
    };
    if (map.isStyleLoaded() && sourceReadyRef.current) {
      loadParcels(viewModeRef.current);
    } else {
      map.on("load", onStyleLoad);
      return () => { map.off("load", onStyleLoad); };
    }
  }, [loadParcels]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 text-sm z-[1000] relative">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("parcels")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "parcels"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Parcels
          </button>
          <button
            onClick={() => setViewMode("density")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "density"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Density
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3 text-gray-500">
          {loading && <span className="animate-pulse">Loading...</span>}
          {!loading && <span>{count.toLocaleString()} parcels</span>}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg px-4 py-3 z-[1000] text-xs">
        {viewMode === "density" ? (
          <>
            <div className="font-semibold text-gray-700 mb-2">Second Home Density</div>
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-24 h-3 rounded"
                style={{
                  background: "linear-gradient(to right, #22c55e, #eab308, #f97316, #dc2626)",
                }}
              />
            </div>
            <div className="flex justify-between text-gray-500 w-24">
              <span>Low</span>
              <span>High</span>
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-gray-700 mb-2">Property Classification</div>
            {[
              { color: "#dc2626", label: "Second Home" },
              { color: "#22c55e", label: "Not a Second Home" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 mb-1">
                <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: color, opacity: 0.7 }} />
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
