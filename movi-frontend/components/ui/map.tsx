"use client";

import type { ComponentProps, ReactNode } from "react";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { ControlPosition } from "leaflet";
import "leaflet/dist/leaflet.css";

type LeafletMapProps = ComponentProps<typeof MapContainer>;

export interface MapProps extends LeafletMapProps {
  /**
   * Optional wrapper className for the map container.
   * Defaults to a full-width, fixed-height card-style container.
   */
  className?: string;
}

export function Map({
  className,
  children,
  style,
  scrollWheelZoom,
  zoomControl,
  ...props
}: MapProps) {
  return (
    <div
      className={
        className ??
        "w-full h-80 rounded-lg overflow-hidden border border-[#111827] bg-[#020617]"
      }
    >
      <MapContainer
        {...props}
        style={{ width: "100%", height: "100%", ...style }}
        scrollWheelZoom={scrollWheelZoom ?? false}
        zoomControl={zoomControl ?? false}
      >
        {children}
      </MapContainer>
    </div>
  );
}

export interface MapTileLayerProps {
  url?: string;
  attribution?: string;
}

export function MapTileLayer({
  url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution = "&copy; OpenStreetMap contributors",
}: MapTileLayerProps) {
  return <TileLayer url={url} attribution={attribution} />;
}

export interface MapMarkerProps {
  position: LatLngExpression;
  children?: ReactNode;
}

export function MapMarker({ position, children }: MapMarkerProps) {
  return <Marker position={position}>{children}</Marker>;
}

export interface MapPopupProps {
  children?: ReactNode;
}

export function MapPopup({ children }: MapPopupProps) {
  return <Popup>{children}</Popup>;
}

export interface MapZoomControlProps {
  position?: ControlPosition;
}

export function MapZoomControl({ position = "bottomright" }: MapZoomControlProps) {
  return <ZoomControl position={position} />;
}


