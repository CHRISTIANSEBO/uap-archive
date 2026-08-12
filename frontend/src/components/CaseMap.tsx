import { useEffect, useRef, useState } from "react";
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

/** MapLibre v4 removed maplibregl.supported(); probe WebGL ourselves. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Clickable map of geocoded cases. Users click a marker to open the case detail.
 * Markers use the annotated-diagram amber-dot treatment from the DNA.
 */
export default function CaseMap({ cases }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const navigate = useNavigate();
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    // MapLibre needs WebGL. On machines/contexts without it, degrade to a plain
    // list instead of throwing and taking down the whole results route.
    if (!webglAvailable()) {
      setUnsupported(true);
      return;
    }
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: STYLE,
        center: [-98.5, 39.5], // continental US
        zoom: 3.2,
        attributionControl: { compact: true },
      });
    } catch {
      setUnsupported(true);
      return;
    }
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
      el.className = "map-marker";
      el.setAttribute("aria-label", `Open case ${c.case_id}`);

      const label =
        c.summary_one_line ??
        (`${c.city ?? ""}${c.state ? ", " + c.state : ""}` || c.case_id);
      const meta = [c.date ?? "date unknown", c.shape && c.shape !== "unknown" ? c.shape : null]
        .filter(Boolean)
        .join(" · ");
      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
        `<strong>${escapeHtml(label)}</strong><br/><span style="font-family:JetBrains Mono,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--color-muted);">${escapeHtml(meta)} · click to open</span>`
      );

      el.addEventListener("click", () =>
        navigate(`/case/${encodeURIComponent(c.case_id)}`)
      );

      const m = new maplibregl.Marker({ element: el })
        .setLngLat([c.longitude!, c.latitude!])
        .setPopup(popup)
        .addTo(map);
      el.addEventListener("mouseenter", () => {
        el.classList.add("map-marker--active");
        m.getPopup()?.isOpen() || m.togglePopup();
      });
      el.addEventListener("mouseleave", () => {
        el.classList.remove("map-marker--active");
        m.getPopup()?.isOpen() && m.togglePopup();
      });
      markers.push(m);
    }

    if (geocoded.length > 1) {
      const b = new maplibregl.LngLatBounds();
      geocoded.forEach((c) => b.extend([c.longitude!, c.latitude!]));
      map.fitBounds(b, { padding: 60, maxZoom: 7, duration: 600 });
    }

    return () => markers.forEach((m) => m.remove());
  }, [cases, navigate]);

  if (unsupported) {
    // Graceful fallback: no WebGL, but the results grid below still renders.
    return (
      <div className="map map--fallback">
        <p className="meta">
          Map needs WebGL, which isn&rsquo;t available here — {cases.length} located
          {cases.length === 1 ? " case is" : " cases are"} listed below.
        </p>
      </div>
    );
  }

  return <div className="map" ref={ref} />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
