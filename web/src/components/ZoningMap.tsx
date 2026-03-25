"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ZONING_CATEGORY_COLORS,
  ZONING_CATEGORY_LIST,
  ZONING_DETAILED_GROUPS,
  getZoningCategory,
  getZoningDetailedColor,
  type ZoningCategory,
} from "@/lib/arcgis";

export interface ZoningFilterValues {
  category: string;
  viewMode: "simplified" | "detailed";
}

interface Props {
  filters: ZoningFilterValues;
  onCountChange: (count: number) => void;
  onLoadingChange: (loading: boolean) => void;
  refreshKey: number;
}

export default function ZoningMap({
  filters,
  onCountChange,
  onLoadingChange,
  refreshKey,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [35.687, -105.938],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const loadZoning = useCallback(async () => {
    if (!mapRef.current) return;
    onLoadingChange(true);
    setError(null);

    const params = new URLSearchParams();
    const bounds = mapRef.current.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(",");
    params.set("bbox", bbox);

    try {
      const resp = await fetch(`/api/zoning?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const geojson = await resp.json();

      if (layerRef.current) {
        mapRef.current.removeLayer(layerRef.current);
        layerRef.current = null;
      }

      let filteredFeatures = geojson.features ?? [];
      if (filters.category) {
        filteredFeatures = filteredFeatures.filter(
          (f: GeoJSON.Feature) => f.properties?.category === filters.category
        );
      }

      const filteredGeoJson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: filteredFeatures,
      };

      layerRef.current = L.geoJSON(filteredGeoJson, {
        style: (feature) => {
          const zdesc = feature?.properties?.ZDESC ?? "";
          const color =
            filters.viewMode === "detailed"
              ? getZoningDetailedColor(zdesc)
              : ZONING_CATEGORY_COLORS[
                  getZoningCategory(zdesc) as ZoningCategory
                ] ?? "#6b7280";
          return {
            color: "#333",
            weight: 0.5,
            fillColor: color,
            fillOpacity: 0.6,
          };
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          const color = getZoningDetailedColor(p.ZDESC);

          layer.bindPopup(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:220px;max-width:320px;">
              <div style="font-weight:700;font-size:15px;margin-bottom:2px;color:${color};">
                ${p.ZDESC}
              </div>
              <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">
                ${p.category}
              </div>
              ${p.DESC_ ? `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;">${p.DESC_}</div>` : ""}
              <div style="margin-bottom:${p.ZAHyperlin ? "8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb" : "0"};">
                ${p.ZORDNO ? `<div><strong>Ordinance:</strong> ${p.ZORDNO}</div>` : ""}
                ${p.ZCASNO ? `<div><strong>Case #:</strong> ${p.ZCASNO}</div>` : ""}
                ${p.COMMENTS ? `<div><strong>Notes:</strong> ${p.COMMENTS}</div>` : ""}
              </div>
              ${p.ZAHyperlin ? `<div><a href="${p.ZAHyperlin}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:underline;">View Zoning Action</a></div>` : ""}
            </div>`,
            { maxWidth: 340 }
          );
        },
      }).addTo(mapRef.current);

      onCountChange(filteredFeatures.length);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to load zoning data"
      );
    } finally {
      onLoadingChange(false);
    }
  }, [filters, onCountChange, onLoadingChange]);

  useEffect(() => {
    loadZoning();
  }, [loadZoning, refreshKey]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const onMoveEnd = () => loadZoning();
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [loadZoning]);

  return (
    <div className="flex flex-col h-full relative">
      {error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded shadow z-[1000] text-sm">
          {error}
        </div>
      )}

      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg z-[1000] text-xs max-h-[60vh] overflow-y-auto">
        <button
          onClick={() => setLegendCollapsed(!legendCollapsed)}
          className="w-full px-4 py-2 flex items-center justify-between font-semibold text-gray-700 sticky top-0 bg-white/95 backdrop-blur"
        >
          <span>
            {filters.viewMode === "detailed" ? "Zoning Districts" : "Zoning Categories"}
          </span>
          <span className="text-gray-400 text-[10px]">
            {legendCollapsed ? "+" : "−"}
          </span>
        </button>

        {!legendCollapsed && (
          <div className="px-4 pb-3">
            {filters.viewMode === "simplified" ? (
              <>
                {ZONING_CATEGORY_LIST.map((cat) => (
                  <div key={cat} className="flex items-center gap-2 mb-1">
                    <span
                      className="w-3 h-3 rounded-sm inline-block shrink-0 border border-gray-300"
                      style={{ backgroundColor: ZONING_CATEGORY_COLORS[cat] }}
                    />
                    <span className="text-gray-600">{cat}</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                {ZONING_DETAILED_GROUPS.map((group) => (
                  <div key={group.heading} className="mb-2">
                    <div className="font-semibold text-gray-500 text-[10px] uppercase tracking-wider mt-1 mb-1">
                      {group.heading}
                    </div>
                    {group.entries.map((entry) => (
                      <div key={entry.label} className="flex items-center gap-2 mb-0.5">
                        <span
                          className="w-3 h-3 rounded-sm inline-block shrink-0 border border-gray-300"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-gray-600">{entry.label}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
