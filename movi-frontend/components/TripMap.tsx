"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Map, MapTileLayer, MapZoomControl } from "@/components/ui/map";

interface TripMapProps {
  stops: {
    name: string;
    latitude: number;
    longitude: number;
  }[];
}

function RecenterOnChange({ center }: { center: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.setView(center, map.getZoom() || 13);
  }, [map, center]);

  return null;
}

export default function TripMap({ stops }: TripMapProps) {
  const positions = useMemo<LatLngExpression[]>(
    () => stops.map((s) => [s.latitude, s.longitude]),
    [stops]
  );

  const center: LatLngExpression = useMemo(() => {
    if (positions.length === 0) return [12.9716, 77.5946]; // default to BLR
    const avgLat =
      positions.reduce((sum, [lat]) => sum + (lat as number), 0) / positions.length;
    const avgLng =
      positions.reduce((sum, [, lng]) => sum + (lng as number), 0) / positions.length;
    return [avgLat, avgLng];
  }, [positions]);

  return (
    <Map
      center={center}
      zoom={13}
      className="w-full h-full rounded-none outline-none bg-gray-100"
    >
      <MapTileLayer />
      <MapZoomControl />
      <RecenterOnChange center={center} />

      {positions.length > 1 && (
        <Polyline positions={positions} pathOptions={{ color: "#16a34a", weight: 4, opacity: 0.8 }} />
      )}

      {stops.map((stop, idx) => (
        <CircleMarker
          key={stop.name + idx}
          center={[stop.latitude, stop.longitude]}
          radius={6}
          pathOptions={{
            color: idx === 0 ? "#15803d" : idx === stops.length - 1 ? "#dc2626" : "#16a34a",
            weight: 2,
            fillColor: "#ffffff",
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1} className="font-sans text-xs font-bold">
             {stop.name} (#{idx+1})
          </Tooltip>
        </CircleMarker>
      ))}
    </Map>
  );
}
