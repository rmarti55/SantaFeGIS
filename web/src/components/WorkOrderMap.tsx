"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  PROBLEM_TYPES,
  PROBLEM_TYPE_COLORS,
  STATUS_LABELS,
} from "@/lib/arcgis";
import type { WorkOrderFilterValues } from "./WorkOrderFilters";

interface Props {
  filters: WorkOrderFilterValues;
  onCountChange: (count: number) => void;
  onLoadingChange: (loading: boolean) => void;
  refreshKey: number;
}

const DISTRICT_COLORS = ["#ed5151", "#149ece", "#a7c636", "#9e559c"];

function formatDate(ts: number | null): string {
  if (!ts) return "N/A";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function WorkOrderMap({
  filters,
  onCountChange,
  onLoadingChange,
  refreshKey,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
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
    markersRef.current = L.layerGroup().addTo(map);

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
              fillOpacity: 0.08,
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

  const loadWorkOrders = useCallback(async () => {
    if (!mapRef.current || !markersRef.current) return;
    onLoadingChange(true);
    setError(null);

    const bounds = mapRef.current.getBounds();
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    const params = new URLSearchParams({ bbox });
    if (filters.problemtype) params.set("problemtype", filters.problemtype);
    if (filters.problem) params.set("problem", filters.problem);
    if (filters.status) params.set("status", filters.status);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    try {
      const resp = await fetch(`/api/work-orders?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const geojson = await resp.json();

      markersRef.current.clearLayers();

      L.geoJSON(geojson, {
        pointToLayer: (_feature, latlng) => {
          const type = _feature.properties?.problemtype ?? "other";
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: PROBLEM_TYPE_COLORS[type] ?? "#94a3b8",
            color: "#fff",
            weight: 1,
            fillOpacity: 0.85,
          });
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          layer.bindPopup(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:220px;">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:${PROBLEM_TYPE_COLORS[p.problemtype] ?? "#333"};">
                ${PROBLEM_TYPES[p.problemtype] ?? p.problemtype}
              </div>
              <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">
                <div style="font-weight:600;">Work Order #${p.objectid}</div>
                <div>${p.Problem ?? "No details"}</div>
              </div>
              <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">
                <div><strong>Status:</strong> ${STATUS_LABELS[p.status] ?? p.status}</div>
                <div><strong>Submitted:</strong> ${formatDate(p.CreationDate)}</div>
                ${p.resolved_on ? `<div><strong>Resolved:</strong> ${formatDate(p.resolved_on)}</div>` : ""}
                ${p.time_to_resolve != null ? `<div><strong>Days to resolve:</strong> ${p.time_to_resolve}</div>` : ""}
              </div>
            </div>`,
            { maxWidth: 320 }
          );
        },
      }).addTo(markersRef.current);

      onCountChange(geojson.features?.length ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load work orders");
    } finally {
      onLoadingChange(false);
    }
  }, [filters, onCountChange, onLoadingChange]);

  useEffect(() => {
    if (!mapRef.current) return;
    loadWorkOrders();

    const map = mapRef.current;
    map.on("moveend", loadWorkOrders);
    return () => {
      map.off("moveend", loadWorkOrders);
    };
  }, [loadWorkOrders, refreshKey]);

  return (
    <div className="flex flex-col h-full relative">
      {error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded shadow z-[1000] text-sm">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg px-4 py-3 z-[1000] text-xs max-h-64 overflow-y-auto">
        <div className="font-semibold text-gray-700 mb-2">Problem Type</div>
        {Object.entries(PROBLEM_TYPES).map(([code, label]) => (
          <div key={code} className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{
                backgroundColor: PROBLEM_TYPE_COLORS[code] ?? "#94a3b8",
              }}
            />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
