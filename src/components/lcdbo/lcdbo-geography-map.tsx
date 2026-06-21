import type { IntelligenceCluster } from "@/lib/data/lcdbo-intelligence";

export function LcdboGeographyMap({ clusters, selectedState }: { clusters: IntelligenceCluster[]; selectedState?: string | null }) {
  const visible = selectedState ? clusters.filter((cluster) => cluster.stateName === selectedState) : clusters;
  return <article className="overflow-hidden rounded-2xl bg-[#0B2E59] p-5 text-white shadow-sm"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#efc85d]">Lightweight GIS view</p><h2 className="mt-1 text-2xl font-black">Nigeria cluster coverage</h2><p className="mt-2 text-sm text-slate-300">Cluster coordinates are projected from existing latitude and longitude records. Unlocated clusters use clearly indicated approximate state placement.</p></div><svg viewBox="0 0 700 430" role="img" aria-label="LCDBO cluster coverage across Nigeria" className="mt-5 w-full rounded-2xl border border-white/10 bg-[#082441]"><path d="M251 49 L382 31 L492 78 L566 149 L555 238 L502 302 L438 385 L333 398 L269 351 L183 319 L140 238 L160 151 L207 112 Z" fill="#0d6b47" fillOpacity="0.28" stroke="#4ade80" strokeOpacity="0.45" strokeWidth="2" />{visible.map((cluster, index) => { const point = project(cluster, index); const active = cluster.status === "active"; return <g key={cluster.id}><circle cx={point.x} cy={point.y} r={Math.min(18, 7 + cluster.memberCount / 8)} fill={active ? "#D4A017" : "#94a3b8"} stroke="#082441" strokeWidth="4"><title>{cluster.name}: {cluster.memberCount} participants</title></circle>{visible.length <= 8 ? <text x={point.x + 12} y={point.y + 4} fill="#ffffff" fontSize="10" fontWeight="700">{cluster.stateName}</text> : null}</g>; })}<text x="24" y="402" fill="#94a3b8" fontSize="11">Circle size indicates participant density</text></svg></article>;
}

function project(cluster: IntelligenceCluster, index: number) {
  if (cluster.latitude != null && cluster.longitude != null) {
    const x = 120 + ((Number(cluster.longitude) - 2.5) / 12.5) * 470;
    const y = 365 - ((Number(cluster.latitude) - 4) / 10) * 310;
    return { x: clamp(x, 150, 560), y: clamp(y, 45, 390) };
  }
  const stateSeed = [...cluster.stateName].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return { x: 190 + ((stateSeed * 37 + index * 41) % 320), y: 85 + ((stateSeed * 19 + index * 29) % 260) };
}
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
