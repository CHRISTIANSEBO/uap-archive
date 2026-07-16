import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { useNavigate } from "react-router-dom";
import type { MatchedCase } from "../types";

// Free, key-less dark raster style (CARTO dark basemap) tinted to match the DNA.
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap · © CARTO",
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

interface Props {
  cases: MatchedCase[];
}

/**
 * Clickable map of geocoded cases. Users click a marker to open the case detail.
 * Markers use the annotated-diagram amber-dot treatment from the DNA.
 */
export default function CaseMap({ cases }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: [-98.5, 39.5], // continental US
      zoom: 3.2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: maplibregl.Marker[] = [];
    const geocoded = cases.filter(
      (c) => c.latitude != null && c.longitude != null
    );

    for (const c of geocoded) {
      const el = document.createElement("button");
      el.setAttribute("aria-label", `Open case ${c.case_id}`);
      el.style.cssText =
        "width:14px;height:14px;border-radius:50%;cursor:pointer;border:2px solid oklch(14% 0.008 65);" +
        "background:oklch(75% 0.13 60);box-shadow:0 0 10px 1px oklch(75% 0.13 60);";

      const label =
        c.summary_one_line ??
        (`${c.city ?? ""}${c.state ? ", " + c.state : ""}` || c.case_id);
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
        `<strong>${escapeHtml(label)}</strong><br/><span style="font-family:JetBrains Mono,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">${c.date ?? "date unknown"} · click to open</span>`
      );

      el.addEventListener("click", () =>
        navigate(`/case/${encodeURIComponent(c.case_id)}`)
      );

      const m = new maplibregl.Marker({ element: el })
        .setLngLat([c.longitude!, c.latitude!])
        .setPopup(popup)
        .addTo(map);
      el.addEventListener("mouseenter", () => m.togglePopup());
      el.addEventListener("mouseleave", () => m.togglePopup());
      markers.push(m);
    }

    if (geocoded.length > 1) {
      const b = new maplibregl.LngLatBounds();
      geocoded.forEach((c) => b.extend([c.longitude!, c.latitude!]));
      map.fitBounds(b, { padding: 60, maxZoom: 7, duration: 600 });
    }

    return () => markers.forEach((m) => m.remove());
  }, [cases, navigate]);

  return <div className="map" ref={ref} />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
