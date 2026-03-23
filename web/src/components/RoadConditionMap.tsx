"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ROAD_CONDITIONS,
  ROAD_CONDITION_COLORS,
  ROAD_SURFACE_TYPES,
  REPAVE_AGE_LEGEND,
  MAINTENANCE_PRIORITY,
  MAINTENANCE_PRIORITY_COLORS,
  repaveAgeColor,
} from "@/lib/arcgis";
import type { RoadConditionFilterValues } from "./RoadConditionFilters";

interface Props {
  filters: RoadConditionFilterValues;
  onCountChange: (count: number) => void;
  onLoadingChange: (loading: boolean) => void;
  refreshKey: number;
}

const DISTRICT_COLORS = ["#ed5151", "#149ece", "#a7c636", "#9e559c"];
const CURRENT_YEAR = new Date().getFullYear();

export default function RoadConditionMap({
  filters,
  onCountChange,
  onLoadingChange,
  refreshKey,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const roadsRef = useRef<L.LayerGroup | null>(null);
  const priorityRef = useRef<L.LayerGroup | null>(null);
  const districtsRef = useRef<L.GeoJSON | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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
    roadsRef.current = L.layerGroup().addTo(map);
    priorityRef.current = L.layerGroup().addTo(map);

    fetch("/api/districts")
      .then((r) => r.json())
      .then((geojson) => {
        if (!geojson.features) return;
        districtsRef.current = L.geoJSON(geojson, {
          style: (feature) => {
            const idx = (feature?.properties?.CouncilDis ?? 1) - 1;
            return {
              color: DISTRICT_COLORS[idx] ?? "#888",
              weight: 2,
              fillOpacity: 0.05,
              fillColor: DISTRICT_COLORS[idx] ?? "#888",
            };
          },
          onEachFeature: (feature, layer) => {
            const p = feature.properties;
            layer.bindPopup(
              `<div style="font-family:system-ui;font-size:13px;">
                <strong>District ${p.CouncilDis}</strong><br/>
                Councilor: ${p.Councilor ?? "N/A"}
              </div>`
            );
          },
        }).addTo(map);
      })
      .catch(() => {});

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const loadRoads = useCallback(async () => {
    if (!mapRef.current || !roadsRef.current || !priorityRef.current) return;
    onLoadingChange(true);
    setError(null);

    const bounds = mapRef.current.getBounds();
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    const params = new URLSearchParams({ bbox, layer: "pavement" });
    if (filters.condition) params.set("condition", filters.condition);
    if (filters.decade) params.set("decade", filters.decade);

    try {
      const resp = await fetch(`/api/road-conditions?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const geojson = await resp.json();

      roadsRef.current.clearLayers();

      L.geoJSON(geojson, {
        style: (feature) => {
          const p = feature?.properties;
          let color: string;

          if (filters.colorBy === "condition") {
            const cond = (p?.RCLCOND ?? " ").trim() || " ";
            color = ROAD_CONDITION_COLORS[cond] ?? "#d1d5db";
          } else {
            color = p?.repave_age_color ?? "#9ca3af";
          }

          return {
            color,
            weight: p?.RCLCLASS === "A10" ? 5 : p?.RCLCLASS === "A20" ? 4 : 3,
            opacity: 0.85,
          };
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          const cond = (p.RCLCOND ?? " ").trim() || " ";
          const condLabel = ROAD_CONDITIONS[cond] ?? cond;
          const surfaceLabel =
            ROAD_SURFACE_TYPES[(p.RCLTYPE ?? "").trim()] ?? p.RCLTYPE ?? "—";
          const streetName = p.STREET || p.RCLNAME || "Unnamed Road";
          const speed = p.SPEEDLIMIT ? `${p.SPEEDLIMIT} mph` : "—";
          const length =
            p.MILES != null
              ? `${p.MILES.toFixed(2)} mi`
              : p.MILE != null
                ? `${p.MILE.toFixed(2)} mi`
                : "—";
          const yearRepave = p.YearRepave && p.YearRepave > 0 ? p.YearRepave : null;
          const age = p.repave_age;
          const ageStr = age != null ? `${age} years ago` : "Unknown";

          layer.bindPopup(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:220px;">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;">
                ${streetName}
              </div>
              <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">
                <div><strong>Last Repaved:</strong> ${yearRepave ?? "Unknown"} (${ageStr})</div>
                <div>
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.repave_age_color};margin-right:6px;vertical-align:middle;"></span>
                  <strong>Condition:</strong> ${condLabel}
                </div>
              </div>
              <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">
                <div><strong>Surface:</strong> ${surfaceLabel}</div>
              </div>
              <div>
                <div><strong>Speed Limit:</strong> ${speed}</div>
                <div><strong>Length:</strong> ${length}</div>
              </div>
            </div>`,
            { maxWidth: 320 }
          );
        },
      }).addTo(roadsRef.current);

      onCountChange(geojson.features?.length ?? 0);

      priorityRef.current.clearLayers();
      if (filters.showPriority) {
        const priParams = new URLSearchParams({ bbox, layer: "priority", priorityOnly: "1" });
        const priResp = await fetch(`/api/road-conditions?${priParams}`);
        if (priResp.ok) {
          const priGeojson = await priResp.json();
          L.geoJSON(priGeojson, {
            style: (feature) => {
              const pri = feature?.properties?.Priority ?? 0;
              return {
                color: MAINTENANCE_PRIORITY_COLORS[pri] ?? "#9ca3af",
                weight: 6,
                opacity: 0.7,
                dashArray: "8 6",
              };
            },
            onEachFeature: (feature, layer) => {
              const p = feature.properties;
              const pri = p.Priority ?? 0;
              layer.bindPopup(
                `<div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:200px;">
                  <div style="font-weight:700;font-size:14px;margin-bottom:4px;">
                    ${p.ROADNAME || "Unnamed Road"}
                  </div>
                  <div style="color:${MAINTENANCE_PRIORITY_COLORS[pri] ?? "#666"};font-weight:600;">
                    Maintenance Priority: ${MAINTENANCE_PRIORITY[pri] ?? pri}
                  </div>
                  ${p.MILES ? `<div><strong>Length:</strong> ${p.MILES.toFixed(2)} mi</div>` : ""}
                </div>`,
                { maxWidth: 300 }
              );
            },
          }).addTo(priorityRef.current);
        }
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to load road conditions"
      );
    } finally {
      onLoadingChange(false);
    }
  }, [filters, onCountChange, onLoadingChange]);

  useEffect(() => {
    if (!mapRef.current) return;
    loadRoads();

    const map = mapRef.current;
    map.on("moveend", loadRoads);
    return () => {
      map.off("moveend", loadRoads);
    };
  }, [loadRoads, refreshKey]);

  const legendItems =
    filters.colorBy === "condition"
      ? Object.entries(ROAD_CONDITIONS).map(([code, label]) => ({
          label,
          color: ROAD_CONDITION_COLORS[code] ?? "#d1d5db",
          style: "solid" as const,
        }))
      : REPAVE_AGE_LEGEND.map((item) => ({
          ...item,
          style: "solid" as const,
        }));

  return (
    <div className="flex flex-col h-full relative">
      {error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded shadow z-[1000] text-sm">
          {error}
        </div>
      )}

      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg px-4 py-3 z-[1000] text-xs max-h-72 overflow-y-auto">
        <div className="font-semibold text-gray-700 mb-2">
          {filters.colorBy === "condition" ? "Condition" : "Years Since Repave"}
        </div>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2 mb-1">
            <span
              className="w-6 h-1 rounded inline-block shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
        {filters.showPriority && (
          <>
            <div className="font-semibold text-gray-700 mt-3 mb-2">
              Crew Priority
            </div>
            {([1, 2, 3] as const).map((pri) => (
              <div key={pri} className="flex items-center gap-2 mb-1">
                <span
                  className="w-6 h-1 rounded inline-block shrink-0"
                  style={{
                    backgroundColor: MAINTENANCE_PRIORITY_COLORS[pri],
                    borderBottom: "2px dashed " + MAINTENANCE_PRIORITY_COLORS[pri],
                  }}
                />
                <span className="text-gray-600">
                  {MAINTENANCE_PRIORITY[pri]}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
