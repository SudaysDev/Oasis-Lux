"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { lerpLatLng, type LatLng } from "@/lib/data/orders";

// Real, interactive Tajikistan map (drag · rotate · tilt · zoom) on free OSM
// raster tiles — no API key. The route + courier use real coordinates; the
// courier's position is interpolated from the order's elapsed time (no GPS feed).
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      // OSM only serves up to z19. With a tilted (pitch) camera maplibre would
      // otherwise request z20–22 for the near field → "Failed to fetch" spam.
      // Cap here so it overzooms from 19 instead of fetching nonexistent tiles.
      maxzoom: 19,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export function RouteMap({
  origin,
  destination,
  progress,
  done,
}: {
  origin: LatLng;
  destination: LatLng;
  progress: number;
  done: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const courierRef = useRef<any>(null);
  const progressRef = useRef(progress);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    void (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      const bearing = (Math.atan2(destination.lng - origin.lng, destination.lat - origin.lat) * 180) / Math.PI;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_STYLE,
        center: [(origin.lng + destination.lng) / 2, (origin.lat + destination.lat) / 2],
        zoom: 7,
        pitch: 55,
        bearing,
        attributionControl: false,
      });
      mapRef.current = map;
      // Swallow transient raster-tile fetch errors (OSM rate-limits / offline) so
      // they don't spam the console & the Next dev error overlay.
      map.on("error", (e) => {
        const msg = e?.error?.message ?? "";
        if (/tile|fetch|\.png/i.test(msg)) return;
        // eslint-disable-next-line no-console
        console.warn("[map]", msg);
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

      const mkEl = (html: string, cls: string) => {
        const el = document.createElement("div");
        el.className = cls;
        el.innerHTML = html;
        return el;
      };

      map.on("load", () => {
        if (cancelled) return;
        // route line
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
            },
          },
        });
        map.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          layout: { "line-cap": "round" },
          paint: { "line-color": "#22d3ee", "line-width": 7, "line-opacity": 0.25, "line-blur": 4 },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round" },
          paint: { "line-color": "#22d3ee", "line-width": 3, "line-dasharray": [1.5, 1] },
        });

        // origin (warehouse) + destination markers
        new maplibregl.Marker({ element: mkEl("🏬", "text-2xl drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]") })
          .setLngLat([origin.lng, origin.lat]).addTo(map);
        new maplibregl.Marker({ element: mkEl("📍", "text-2xl drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]") })
          .setLngLat([destination.lng, destination.lat]).addTo(map);

        // courier
        const courierEl = mkEl(
          `<span class="route-courier"><span class="route-courier-ping"></span>🚚</span>`,
          "",
        );
        const start = lerpLatLng(origin, destination, progressRef.current);
        const courier = new maplibregl.Marker({ element: courierEl }).setLngLat([start.lng, start.lat]).addTo(map);
        courierRef.current = courier;

        map.fitBounds(
          [[Math.min(origin.lng, destination.lng), Math.min(origin.lat, destination.lat)],
           [Math.max(origin.lng, destination.lng), Math.max(origin.lat, destination.lat)]],
          { padding: 70, pitch: 55, bearing, duration: 0, maxZoom: 12 },
        );
      });

      cleanup = () => map.remove();
    })();

    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, destination.lat, destination.lng]);

  // move the courier when progress changes
  useEffect(() => {
    progressRef.current = progress;
    const c = courierRef.current;
    if (!c) return;
    const p = lerpLatLng(origin, destination, done ? 1 : progress);
    c.setLngLat([p.lng, p.lat]);
  }, [progress, done, origin, destination]);

  return <div ref={containerRef} className="route-map h-full w-full" />;
}
