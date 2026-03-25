"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_COLORS,
  PROJECT_PHASES,
  FUNDED_STATUS,
} from "@/lib/arcgis";

export interface CapitalProjectFilterValues {
  projtype: string;
  projphase: string;
}

interface Props {
  filters: CapitalProjectFilterValues;
  onCountChange: (count: number) => void;
  onLoadingChange: (loading: boolean) => void;
  refreshKey: number;
}

function formatDate(ts: number | null): string {
  if (!ts) return "N/A";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value: number | null): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CapitalProjectsMap({
  filters,
  onCountChange,
  onLoadingChange,
  refreshKey,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const loadProjects = useCallback(async () => {
    if (!mapRef.current) return;
    onLoadingChange(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.projtype) params.set("projtype", filters.projtype);
    if (filters.projphase) params.set("projphase", filters.projphase);

    try {
      const resp = await fetch(`/api/capital-projects?${params}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const geojson = await resp.json();

      if (layerRef.current) {
        mapRef.current.removeLayer(layerRef.current);
        layerRef.current = null;
      }

      layerRef.current = L.geoJSON(geojson, {
        style: (feature) => {
          const div = feature?.properties?.Division ?? "";
          return {
            color: PROJECT_TYPE_COLORS[div] ?? "#94a3b8",
            weight: 2,
            fillColor: PROJECT_TYPE_COLORS[div] ?? "#94a3b8",
            fillOpacity: 0.35,
          };
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          const color = PROJECT_TYPE_COLORS[p.Division] ?? "#333";

          layer.bindPopup(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:260px;max-width:340px;">
              <div style="font-weight:700;font-size:15px;margin-bottom:4px;color:${color};">
                ${p.Project_Title ?? "Unnamed Project"}
              </div>
              ${p.MasterLedgerID ? `<div style="font-size:11px;color:#6b7280;margin-bottom:6px;">ID: ${p.MasterLedgerID}</div>` : ""}
              ${p.Description ? `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;">${p.Description}</div>` : ""}
              <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;">
                <div><strong>Division:</strong> ${PROJECT_TYPES[p.Division] ?? p.Division}</div>
                <div><strong>Project Type:</strong> ${p.ProjectType ?? "N/A"}</div>
                <div><strong>Phase:</strong> ${PROJECT_PHASES[p.Phase] ?? p.Phase ?? "N/A"}</div>
                <div><strong>Funding:</strong> ${FUNDED_STATUS[p.Funded] ?? p.Funded ?? "N/A"}</div>
                ${p.Facility ? `<div><strong>Facility:</strong> ${p.Facility}</div>` : ""}
                ${p.Urgency ? `<div><strong>Urgency:</strong> ${p.Urgency === "H" ? "High" : p.Urgency === "M" ? "Medium" : p.Urgency === "L" ? "Low" : p.Urgency}</div>` : ""}
              </div>
              <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;">
                <div><strong>Total Cost:</strong> ${formatCurrency(p.TotalCost)}</div>
                <div><strong>Design Cost:</strong> ${formatCurrency(p.DesignCost)}</div>
                <div><strong>Construction Cost:</strong> ${formatCurrency(p.ConstructionCost)}</div>
                ${p.FundedtoDate2 != null ? `<div><strong>Funded to Date:</strong> ${formatCurrency(p.FundedtoDate2)}</div>` : ""}
              </div>
              <div style="margin-bottom:${p.PM ? "8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb" : "0"};">
                <div><strong>Est. Construction Start:</strong> ${formatDate(p.EstConstructionStart)}</div>
                <div><strong>Operational Date:</strong> ${formatDate(p.OperationalDate)}</div>
                ${p.UsefulLife ? `<div><strong>Useful Life:</strong> ${p.UsefulLife}</div>` : ""}
              </div>
              ${p.PM ? `<div style="font-size:12px;color:#6b7280;">
                <div><strong>Project Manager:</strong> ${p.PM}</div>
              </div>` : ""}
            </div>`,
            { maxWidth: 360 }
          );
        },
      }).addTo(mapRef.current);

      if (geojson.features?.length > 0) {
        mapRef.current.fitBounds(layerRef.current.getBounds(), {
          padding: [40, 40],
        });
      }

      onCountChange(geojson.features?.length ?? 0);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to load capital projects"
      );
    } finally {
      onLoadingChange(false);
    }
  }, [filters, onCountChange, onLoadingChange]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, refreshKey]);

  return (
    <div className="flex flex-col h-full relative">
      {error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded shadow z-[1000] text-sm">
          {error}
        </div>
      )}

      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg px-4 py-3 z-[1000] text-xs">
        <div className="font-semibold text-gray-700 mb-2">Division</div>
        {Object.entries(PROJECT_TYPES).map(([code, label]) => (
          <div key={code} className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-sm inline-block shrink-0"
              style={{
                backgroundColor: PROJECT_TYPE_COLORS[code] ?? "#94a3b8",
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
