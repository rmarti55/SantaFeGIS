"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import {
  PROBLEM_TYPES,
  PROBLEM_TYPE_COLORS,
  STATUS_LABELS,
} from "@/lib/arcgis";
import type { WorkOrderFilterValues } from "./WorkOrderFilters";

type ViewMode = "markers" | "heatmap";

interface Props {
  filters: WorkOrderFilterValues;
  onCountChange: (count: number) => void;
  onLoadingChange: (loading: boolean) => void;
  refreshKey: number;
}

const DISTRICT_COLORS = ["#ed5151", "#149ece", "#a7c636", "#9e559c"];
const HEAT_GRADIENT = {
  0.0: "#22c55e",
  0.5: "#eab308",
  1.0: "#dc2626",
};

function formatDate(ts: number | null): string {
  if (!ts) return "N/A";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface DetailData {
  id: number;
  objectid: number;
  problemtype: string;
  status: string;
  status_label: string;
  problem: string | null;
  description: string | null;
  assigned_to: string | null;
  resolution: string | null;
  field_notes: string | null;
  response_comments: string | null;
  response_notes: string | null;
  work_order_number: string | null;
  councilor: string | null;
  created: number;
  resolved: number | null;
  days_to_resolve: number | null;
  geometry: { x: number; y: number };
  encampment: {
    location: string | null;
    people_estimate: string | null;
    items_identified: string | null;
    active_or_abandoned: string | null;
  };
  vehicle: {
    location: string | null;
    license_plate: string | null;
    make_model: string | null;
    color: string | null;
  };
  pothole: { approximate_size: string | null };
  dumping: { objects_dumped: string | null };
  graffiti: { located_on: string | null };
  property: {
    type: string | null;
    unsightliness_items: string | null;
  };
}

function renderPopupDetail(detail: DetailData): string {
  const color = PROBLEM_TYPE_COLORS[detail.problemtype] ?? "#333";
  const typeLabel = PROBLEM_TYPES[detail.problemtype] ?? detail.problemtype;

  const sections: string[] = [
    // Header
    `<div style="font-weight:700;font-size:14px;margin-bottom:4px;color:${color};">
      ${typeLabel}
      <span style="font-size:12px;margin-left:8px;padding:2px 6px;background:#e5e7eb;border-radius:3px;color:#374151;font-weight:600;">${detail.status_label}</span>
    </div>`,
  ];

  // Sub-problem
  if (detail.problem) {
    sections.push(
      `<div style="font-weight:600;font-size:13px;margin-bottom:2px;color:#1f2937;">${detail.problem}</div>`
    );
  }

  // Work order number and councilor
  if (detail.work_order_number || detail.councilor) {
    sections.push(
      `<div style="font-size:12px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">
        ${detail.work_order_number ? `<div>WO#: ${detail.work_order_number}</div>` : ""}
        ${detail.councilor ? `<div>Councilor: ${detail.councilor}</div>` : ""}
      </div>`
    );
  }

  // Description
  if (detail.description) {
    const truncated =
      detail.description.length > 300
        ? detail.description.substring(0, 300) + "..."
        : detail.description;
    sections.push(
      `<div style="font-size:12px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;color:#374151;">
        <div style="font-weight:600;color:#1f2937;margin-bottom:2px;">Description:</div>
        <div style="white-space:pre-wrap;word-wrap:break-word;">${truncated}</div>
      </div>`
    );
  }

  // Assignment & Resolution
  if (detail.assigned_to || detail.resolution) {
    sections.push(
      `<div style="font-size:12px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;color:#374151;">
        ${detail.assigned_to ? `<div><strong>Assigned to:</strong> ${detail.assigned_to}</div>` : ""}
        ${detail.resolution ? `<div><strong>Resolution:</strong> ${detail.resolution}</div>` : ""}
      </div>`
    );
  }

  // Type-specific fields
  const typeSpecific = getTypeSpecificFields(detail);
  if (typeSpecific) {
    sections.push(
      `<div style="font-size:12px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;color:#374151;">
        ${typeSpecific}
      </div>`
    );
  }

  // Timeline
  sections.push(
    `<div style="font-size:12px;color:#6b7280;">
      <div><strong>Submitted:</strong> ${formatDate(detail.created)}</div>
      ${detail.resolved ? `<div><strong>Resolved:</strong> ${formatDate(detail.resolved)}</div>` : ""}
      ${detail.days_to_resolve != null ? `<div><strong>Days to resolve:</strong> ${detail.days_to_resolve}</div>` : ""}
    </div>`
  );

  return `<div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:300px;max-height:500px;overflow-y:auto;">
    ${sections.join("")}
  </div>`;
}

function getTypeSpecificFields(detail: DetailData): string {
  const { problemtype, encampment, vehicle, pothole, dumping, graffiti, property } = detail;

  if (problemtype === "encampments" && encampment.location) {
    return `
      <div><strong>Location:</strong> ${encampment.location}</div>
      ${encampment.people_estimate ? `<div><strong>People:</strong> ${encampment.people_estimate}</div>` : ""}
      ${encampment.items_identified ? `<div><strong>Items:</strong> ${encampment.items_identified}</div>` : ""}
      ${encampment.active_or_abandoned ? `<div><strong>Status:</strong> ${encampment.active_or_abandoned}</div>` : ""}
    `;
  }

  if (problemtype === "abandonedvehicle" && vehicle.location) {
    return `
      <div><strong>Location:</strong> ${vehicle.location}</div>
      ${vehicle.license_plate ? `<div><strong>Plate:</strong> ${vehicle.license_plate}</div>` : ""}
      ${vehicle.make_model ? `<div><strong>Make/Model:</strong> ${vehicle.make_model}</div>` : ""}
      ${vehicle.color ? `<div><strong>Color:</strong> ${vehicle.color}</div>` : ""}
    `;
  }

  if (problemtype === "roads" && pothole.approximate_size) {
    return `<div><strong>Size:</strong> ${pothole.approximate_size}</div>`;
  }

  if (problemtype === "dumping" && dumping.objects_dumped) {
    return `<div><strong>Objects:</strong> ${dumping.objects_dumped}</div>`;
  }

  if (problemtype === "graffiti" && graffiti.located_on) {
    return `<div><strong>Located on:</strong> ${graffiti.located_on}</div>`;
  }

  if (problemtype === "property") {
    return `
      ${property.type ? `<div><strong>Type:</strong> ${property.type}</div>` : ""}
      ${property.unsightliness_items ? `<div><strong>Items:</strong> ${property.unsightliness_items}</div>` : ""}
    `;
  }

  return "";
}

function renderHeatmap(map: L.Map, geojson: any): L.Layer | null {
  if (!geojson || !geojson.features) return null;

  const points = geojson.features
    .filter((f: any) => f.geometry?.type === "Point" && f.geometry?.coordinates)
    .map((f: any) => {
      const [lng, lat] = f.geometry.coordinates;
      return [lat, lng, 1];
    });

  if (points.length === 0) return null;

  return (L.heatLayer as any)(points, {
    radius: 25,
    blur: 20,
    maxZoom: 17,
    minOpacity: 0.3,
    gradient: HEAT_GRADIENT,
  }).addTo(map);
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
  const heatRef = useRef<L.Layer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("markers");
  const [geojsonData, setGeojsonData] = useState<any>(null);

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

  const applyView = useCallback(() => {
    if (!mapRef.current || !markersRef.current) return;

    // Remove existing heat layer
    if (heatRef.current) {
      mapRef.current.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    // Remove markers
    markersRef.current.clearLayers();

    if (viewMode === "heatmap" && geojsonData) {
      // Render heatmap
      const heat = renderHeatmap(mapRef.current, geojsonData);
      if (heat) {
        heatRef.current = heat;
      }
    } else if (viewMode === "markers" && geojsonData) {
      // Render markers
      L.geoJSON(geojsonData, {
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
          const recordId = p.id;

          // Initial loading popup
          layer.bindPopup(
            `<div style="font-family:system-ui;font-size:13px;padding:8px;text-align:center;">Loading...</div>`,
            { maxWidth: 420, className: "wo-popup" }
          );

          // Fetch full details when popup opens
          layer.on("popupopen", async () => {
            if (!recordId) return;
            try {
              const resp = await fetch(`/api/work-orders/${recordId}`);
              if (!resp.ok) throw new Error("Failed to load details");
              const detail = await resp.json();

              const html = renderPopupDetail(detail);
              layer.getPopup()?.setContent(html);
            } catch (err) {
              layer.getPopup()?.setContent(
                `<div style="font-family:system-ui;font-size:13px;color:#dc2626;">Error loading details</div>`
              );
            }
          });
        },
      }).addTo(markersRef.current);
    }
  }, [viewMode, geojsonData]);

  const loadWorkOrders = useCallback(async () => {
    if (!mapRef.current || !markersRef.current) return;
    onLoadingChange(true);
    setError(null);

    const bounds = mapRef.current.getBounds();
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    // Convert dateRange to dateFrom/dateTo
    const today = new Date();
    const daysMap: Record<string, number> = {
      "7d": 7,
      "14d": 14,
      "30d": 30,
      "60d": 60,
      "90d": 90,
      "180d": 180,
      "365d": 365,
      "730d": 730,
    };
    const days = daysMap[filters.dateRange] || 30;
    const dateFrom = new Date(today);
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString().split("T")[0];
    const dateToStr = today.toISOString().split("T")[0];

    const params = new URLSearchParams({ bbox });
    if (filters.status) params.set("status", filters.status);
    if (filters.problem) params.set("problem", filters.problem);
    params.set("dateFrom", dateFromStr);
    params.set("dateTo", dateToStr);

    try {
      const resp = await fetch(`/api/work-orders?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const geojson = await resp.json();

      setGeojsonData(geojson);
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

  useEffect(() => {
    applyView();
  }, [applyView, viewMode]);

  return (
    <div className="flex flex-col h-full relative">
      {error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded shadow z-[1000] text-sm">
          {error}
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur rounded-lg shadow-lg z-[1000] flex">
        <button
          onClick={() => setViewMode("markers")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === "markers"
              ? "bg-blue-500 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Markers
        </button>
        <div className="w-px bg-gray-200" />
        <button
          onClick={() => setViewMode("heatmap")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === "heatmap"
              ? "bg-blue-500 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Density
        </button>
      </div>

      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
