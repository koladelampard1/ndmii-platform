"use client";

import { useMemo, useState } from "react";

export type NrsStateMetric = {
  state: string;
  businesses: number;
  verified: number;
  compliant: number;
  revenueGuides: number;
  vatExposure: number;
  sectors: string[];
};

const stateLayout = [
  ["Sokoto", "Katsina", "Jigawa", "Yobe", "Borno"],
  ["Kebbi", "Zamfara", "Kano", "Bauchi", "Gombe"],
  ["Niger", "Kaduna", "Plateau", "Adamawa", "Taraba"],
  ["Kwara", "Federal Capital Territory", "Nasarawa", "Benue", "Kogi"],
  ["Oyo", "Osun", "Ekiti", "Ondo", "Edo"],
  ["Lagos", "Ogun", "Delta", "Anambra", "Enugu"],
  ["Rivers", "Bayelsa", "Akwa Ibom", "Cross River", "Abia"],
  ["Ebonyi", "Imo"],
];

function intensity(value: number, max: number) {
  if (!value) return "fill-slate-100 stroke-slate-200 text-slate-400";
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.75) return "fill-emerald-700 stroke-emerald-800 text-white";
  if (ratio >= 0.45) return "fill-emerald-500 stroke-emerald-600 text-white";
  if (ratio >= 0.2) return "fill-emerald-300 stroke-emerald-500 text-emerald-950";
  return "fill-emerald-100 stroke-emerald-300 text-emerald-900";
}

function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}

export function NationalRevenueMap({ states }: { states: NrsStateMetric[] }) {
  const byState = useMemo(() => new Map(states.map((item) => [item.state, item])), [states]);
  const maxBusinesses = Math.max(1, ...states.map((item) => item.businesses));
  const [selectedState, setSelectedState] = useState(states[0]?.state ?? "Lagos");
  const selected = byState.get(selectedState) ?? { state: selectedState, businesses: 0, verified: 0, compliant: 0, revenueGuides: 0, vatExposure: 0, sectors: [] };

  return (
    <article className="presentation-expand rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">National Map</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Revenue-readiness by state</h2>
          <p className="mt-1 text-sm text-slate-600">A lightweight executive map using DBIN aggregate records. No GIS engine or external data source is used.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">DBIN Derived</span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl bg-slate-50 p-4">
          <svg viewBox="0 0 560 340" role="img" aria-label="Clickable Nigeria state revenue-readiness map" className="h-auto w-full">
            {stateLayout.flatMap((row, rowIndex) =>
              row.map((state, colIndex) => {
                const metric = byState.get(state);
                const x = 18 + colIndex * 104 + (rowIndex % 2) * 18;
                const y = 18 + rowIndex * 39;
                return (
                  <g key={state} role="button" tabIndex={0} onClick={() => setSelectedState(state)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedState(state); }} className="cursor-pointer outline-none">
                    <rect x={x} y={y} width="92" height="30" rx="10" className={`${intensity(metric?.businesses ?? 0, maxBusinesses)} transition hover:opacity-80`} />
                    <text x={x + 46} y={y + 19} textAnchor="middle" className="pointer-events-none fill-current text-[9px] font-semibold">
                      {state === "Federal Capital Territory" ? "FCT" : state}
                    </text>
                  </g>
                );
              })
            )}
          </svg>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-200" /> No current records</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-300" /> Emerging</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" /> High activity</span>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Selected State</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-950">{selected.state}</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Businesses</p><p className="text-xl font-semibold">{selected.businesses}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Verified</p><p className="text-xl font-semibold">{selected.verified}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Compliance</p><p className="text-xl font-semibold">{selected.compliant}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Guides</p><p className="text-xl font-semibold">{selected.revenueGuides}</p></div>
          </div>
          <div className="mt-3 rounded-xl border p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">VAT Exposure</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{formatNaira(selected.vatExposure)}</p>
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Active sectors</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.sectors.length === 0 && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Available after wider rollout</span>}
              {selected.sectors.map((sector) => <span key={sector} className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{sector}</span>)}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
