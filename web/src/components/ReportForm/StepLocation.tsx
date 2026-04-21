"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lng: number | null;
  lat: number | null;
  addressText: string;
  onLocationChange: (lng: number, lat: number) => void;
  onAddressChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const SF_CENTER: [number, number] = [35.687, -105.938];
const SF_BOUNDS = { minLng: -106.2, maxLng: -105.7, minLat: 35.5, maxLat: 35.9 };

export default function StepLocation({
  lng,
  lat,
  addressText,
  onLocationChange,
  onAddressChange,
  onNext,
  onBack,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: SF_CENTER,
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // If we already have a location, drop the pin
    if (lng != null && lat != null) {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onLocationChange(pos.lng, pos.lat);
      });
      markerRef.current = marker;
      map.setView([lat, lng], 15);
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;

      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        const marker = L.marker([clickLat, clickLng], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onLocationChange(pos.lng, pos.lat);
        });
        markerRef.current = marker;
      }

      onLocationChange(clickLng, clickLat);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { longitude, latitude } = pos.coords;
        onLocationChange(longitude, latitude);

        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 17);
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            const marker = L.marker([latitude, longitude], { draggable: true }).addTo(
              mapRef.current
            );
            marker.on("dragend", () => {
              const p = marker.getLatLng();
              onLocationChange(p.lng, p.lat);
            });
            markerRef.current = marker;
          }
        }
      },
      (err) => {
        setLocating(false);
        setGeoError("Could not get your location: " + err.message);
      }
    );
  }

  const outOfBounds =
    lng != null && lat != null &&
    (lng < SF_BOUNDS.minLng || lng > SF_BOUNDS.maxLng ||
      lat < SF_BOUNDS.minLat || lat > SF_BOUNDS.maxLat);

  const canProceed = lng != null && lat != null && !outOfBounds;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-3 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Where is the issue?</h2>
        <p className="text-gray-500 text-sm mb-3">
          Tap the map to drop a pin, or use your location.
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={handleUseMyLocation}
            disabled={locating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
          >
            {locating ? (
              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>📍</span>
            )}
            {locating ? "Locating…" : "Use my location"}
          </button>
        </div>

        {geoError && (
          <p className="text-xs text-red-500 mb-2">{geoError}</p>
        )}
        {outOfBounds && (
          <p className="text-xs text-red-500 mb-2">
            That location is outside Santa Fe city limits. Please move the pin.
          </p>
        )}
        {lat != null && lng != null && !outOfBounds && (
          <p className="text-xs text-green-600 mb-2">
            ✓ Pin placed at {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        )}
      </div>

      <div ref={containerRef} className="flex-1 min-h-0" style={{ zIndex: 0 }} />

      <div className="px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0 space-y-3">
        <input
          type="text"
          value={addressText}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Street address or landmark (optional)"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {canProceed ? "Next: Your Contact Info" : "Drop a pin to continue"}
        </button>
      </div>
    </div>
  );
}
