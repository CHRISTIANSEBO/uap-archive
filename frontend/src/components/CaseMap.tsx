import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useNavigate } from "react-router-dom";
import type { MatchedCase } from "../types";

// Free, key-less dark raster style (CARTO dark basemap) tinted to match the DNA,
// rendered as an interactive 3D globe with a warm atmospheric halo.
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
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
  layers: [
    // Deep near-black "space" behind the globe.
    {
      id: "space",
      type: "background",
      paint: { "background-color": "#0C0B0A" },
    },
    { id: "carto", type: "raster", source: "carto" },
  ],
  // Warm amber atmosphere so the globe reads as "a redacted file lit by a
  // single desk lamp" rather than a generic blue Earth.
  sky: {
    "sky-color": "#0C0B0A",
    "sky-horizon-blend": 0.5,
    "horizon-color": "#3a2a1a",
    "horizon-fog-blend": 0.6,
    "fog-color": "#0C0B0A",
    "fog-ground-blend": 0.4,
    "atmosphere-blend": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      1,
      4,
      0.6,
      6,
      0,
    ],
  },
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
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
        zoom: 2.4, // pulled back so the globe reads as a sphere
        attributionControl: { compact: true },
      });
    } catch {
      setUnsupported(true);
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    mapRef.current = map;

    // Gentle idle auto-rotation to show off the globe. Stops permanently on the
    // first user interaction, and never runs for reduced-motion users.
    let spinning = !prefersReducedMotion();
    let raf = 0;
    let last = performance.now();
    const DEG_PER_SEC = 4;
    const spin = (now: number) => {
      if (!spinning || !mapRef.current) return;
      const dt = (now - last) / 1000;
      last = now;
      const c = map.getCenter();
      // Only spin when zoomed out enough that the sphere is visible.
      if (map.getZoom() < 4 && !map.isMoving()) {
        map.setCenter([c.lng - DEG_PER_SEC * dt, c.lat]);
      }
      raf = requestAnimationFrame(spin);
    };
    const stopSpin = () => {
      spinning = false;
      if (raf) cancelAnimationFrame(raf);
    };
    map.on("mousedown", stopSpin);
    map.on("touchstart", stopSpin);
    map.on("wheel", stopSpin);
    map.on("dragstart", stopSpin);
    map.once("load", () => {
      // Start spinning shortly after any initial fitBounds settles.
      setTimeout(() => {
        if (spinning) {
          last = performance.now();
          raf = requestAnimationFrame(spin);
        }
      }, 2200);
    });

    return () => {
      stopSpin();
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
      el.type = "button";
      el.className = "map-marker";
      const where =
        `${c.city ?? ""}${c.state ? ", " + c.state : ""}`.trim() || c.case_id;
      el.setAttribute("aria-label", `Open case: ${c.summary_one_line ?? where}`);

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
      // Respect reduced-motion: skip the fly animation for those users.
      map.fitBounds(b, {
        padding: 90,
        // Gentler max zoom keeps the curvature of the globe visible.
        maxZoom: 3.6,
        duration: prefersReducedMotion() ? 0 : 900,
      });
    } else if (geocoded.length === 1) {
      const only = geocoded[0];
      map.easeTo({
        center: [only.longitude!, only.latitude!],
        zoom: 4,
        duration: prefersReducedMotion() ? 0 : 900,
      });
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

  return (
    <div
      className="map"
      ref={ref}
      role="region"
      aria-label="Map of geocoded case locations"
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
