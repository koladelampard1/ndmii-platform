"use client";

import { useState } from "react";
import type { PublicPropertyMapMarker } from "@/lib/property/property-gis-service";
import type { PropertyGeometry, PropertyGeometryEvent } from "@/types/property";

type Point = { lat: number; lng: number };

function project(point: Point) {
  const x = ((point.lng - 2) / 13) * 100;
  const y = 100 - ((point.lat - 4) / 10) * 100;
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
}

function unproject(x: number, y: number): Point {
  return {
    lng: Number((2 + (x / 100) * 13).toFixed(7)),
    lat: Number((4 + ((100 - y) / 100) * 10).toFixed(7)),
  };
}

function polygonGeojson(points: Point[]) {
  if (points.length < 3) return "";
  const closed = [...points, points[0]].map((point) => [point.lng, point.lat]);
  return JSON.stringify({ type: "Polygon", coordinates: [closed] });
}

function parseInitialPoint(latitude?: string | number | null, longitude?: string | number | null): Point | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function PropertyGeometryCapture({
  latitude,
  longitude,
  geometry,
}: {
  latitude?: string | number | null;
  longitude?: string | number | null;
  geometry?: PropertyGeometry | null;
}) {
  const initialPoint = parseInitialPoint(geometry?.centroid_latitude ?? latitude, geometry?.centroid_longitude ?? longitude);
  const [point, setPoint] = useState<Point | null>(initialPoint);
  const [points, setPoints] = useState<Point[]>([]);
  const [mode, setMode] = useState<"point" | "polygon">("point");
  const geojson = points.length >= 3 ? polygonGeojson(points) : JSON.stringify(geometry?.geojson && Object.keys(geometry.geojson).length ? geometry.geojson : {});

  function onMapClick(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const next = unproject(x, y);
    setPoint(next);
    if (mode === "polygon") setPoints((current) => [...current, next]);
  }

  const pointProjection = point ? project(point) : null;
  const polygonPath = points.map((item) => {
    const projected = project(item);
    return `${projected.x},${projected.y}`;
  }).join(" ");

  return (
    <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Boundary intelligence</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">Optional. Map boundaries are subject to registry verification and are not a legal survey.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("point")} className={`rounded-xl px-3 py-2 text-xs font-black ${mode === "point" ? "bg-[#06172f] text-white" : "bg-white text-[#06172f]"}`}>Set point</button>
          <button type="button" onClick={() => setMode("polygon")} className={`rounded-xl px-3 py-2 text-xs font-black ${mode === "polygon" ? "bg-[#06172f] text-white" : "bg-white text-[#06172f]"}`}>Draw boundary</button>
          <button type="button" onClick={() => setPoints([])} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700">Clear boundary</button>
        </div>
      </div>

      <svg viewBox="0 0 100 100" onClick={onMapClick} className="mt-4 h-72 w-full cursor-crosshair rounded-2xl border border-emerald-100 bg-[#082441]" role="img" aria-label="Simple Nigeria coordinate capture map">
        <path d="M34 8 L55 5 L76 17 L88 38 L83 59 L69 73 L58 91 L43 94 L31 80 L17 73 L9 56 L13 35 L24 22 Z" fill="#0f8f61" fillOpacity="0.35" stroke="#6ee7b7" strokeWidth="0.8" />
        {polygonPath ? <polygon points={polygonPath} fill="#facc15" fillOpacity="0.25" stroke="#facc15" strokeWidth="1.2" /> : null}
        {points.map((item, index) => {
          const projected = project(item);
          return <circle key={`${item.lat}-${item.lng}-${index}`} cx={projected.x} cy={projected.y} r="1.8" fill="#facc15" stroke="#082441" strokeWidth="0.8" />;
        })}
        {pointProjection ? <circle cx={pointProjection.x} cy={pointProjection.y} r="2.6" fill="#ef4444" stroke="white" strokeWidth="1" /> : null}
        <text x="5" y="95" fill="#cbd5e1" fontSize="3">Click to set coordinate. Drawn polygons are approximate until registry verification.</text>
      </svg>

      <input type="hidden" name="boundary_geojson" value={geojson} />
      <input type="hidden" name="geometry_type" value={points.length >= 3 ? "polygon" : "point"} />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Latitude
          <input name="centroid_latitude" value={point?.lat ?? ""} onChange={(event) => setPoint({ lat: Number(event.target.value), lng: point?.lng ?? 0 })} type="number" step="0.0000001" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal" />
        </label>
        <label className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Longitude
          <input name="centroid_longitude" value={point?.lng ?? ""} onChange={(event) => setPoint({ lat: point?.lat ?? 0, lng: Number(event.target.value) })} type="number" step="0.0000001" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal" />
        </label>
      </div>
    </div>
  );
}

export function GeometryPreview({ geometry, publicSafe = false }: { geometry?: PropertyGeometry | null; publicSafe?: boolean }) {
  if (!geometry?.centroid_latitude || !geometry?.centroid_longitude) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        No boundary coordinate has been captured yet.
      </div>
    );
  }
  const point = { lat: Number(geometry.centroid_latitude), lng: Number(geometry.centroid_longitude) };
  const projected = project(point);
  return (
    <div>
      <svg viewBox="0 0 100 100" className="h-64 w-full rounded-2xl border border-slate-200 bg-[#082441]" role="img" aria-label="Property boundary preview">
        <path d="M34 8 L55 5 L76 17 L88 38 L83 59 L69 73 L58 91 L43 94 L31 80 L17 73 L9 56 L13 35 L24 22 Z" fill="#0f8f61" fillOpacity="0.35" stroke="#6ee7b7" strokeWidth="0.8" />
        <circle cx={projected.x} cy={projected.y} r="2.6" fill={publicSafe ? "#facc15" : "#ef4444"} stroke="white" strokeWidth="1" />
        <text x="5" y="95" fill="#cbd5e1" fontSize="3">{publicSafe ? "Generalized public location" : "Registry boundary preview"}</text>
      </svg>
      <p className="mt-2 text-xs font-bold text-slate-500">Centroid: {point.lat}, {point.lng}</p>
    </div>
  );
}

export function GeometryHistory({ events }: { events: PropertyGeometryEvent[] }) {
  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id} className="rounded-2xl bg-slate-50 p-3">
          <p className="text-sm font-black capitalize text-[#06172f]">{event.event_type.replace("geometry.", "").replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs text-slate-500">{event.summary ?? "Geometry event recorded."} · {new Date(event.created_at).toLocaleString("en-NG")}</p>
        </div>
      ))}
      {!events.length ? <p className="text-sm text-slate-500">No boundary history recorded yet.</p> : null}
    </div>
  );
}

export function PublicPropertyMap({ markers }: { markers: PublicPropertyMapMarker[] }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <svg viewBox="0 0 100 100" className="h-[32rem] w-full rounded-2xl bg-[#082441]" role="img" aria-label="Privacy-safe public property map">
        <path d="M34 8 L55 5 L76 17 L88 38 L83 59 L69 73 L58 91 L43 94 L31 80 L17 73 L9 56 L13 35 L24 22 Z" fill="#0f8f61" fillOpacity="0.35" stroke="#6ee7b7" strokeWidth="0.8" />
        {markers.map((marker) => {
          const point = project({ lat: marker.latitude, lng: marker.longitude });
          return (
            <g key={marker.npin}>
              <a href={marker.profileHref}>
                <circle cx={point.x} cy={point.y} r="2.4" fill="#facc15" stroke="#082441" strokeWidth="0.9">
                  <title>{marker.npin} · {marker.category} · {marker.lga}, {marker.state}</title>
                </circle>
              </a>
            </g>
          );
        })}
        <text x="5" y="95" fill="#cbd5e1" fontSize="3">Markers are generalized public locations. Private boundaries are not disclosed.</text>
      </svg>
      {!markers.length ? <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No public-safe map markers are available yet.</p> : null}
    </div>
  );
}
