import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { LcdboClusterCard, LcdboPartnerCard } from "@/lib/lcdbo/content";
import { formatNairaCompact } from "@/lib/lcdbo/content";

export function StatGrid({ stats }: { stats: readonly { label: string; value: string; detail: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D4A017]/50 hover:shadow-md">
          <p className="text-3xl font-black tracking-tight text-[#0B2E59]">{stat.value}</p>
          <h3 className="mt-2 text-sm font-black text-slate-900">{stat.label}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{stat.detail}</p>
        </article>
      ))}
    </div>
  );
}

export function FlowDiagram({ items }: { items: readonly string[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-[860px] items-center gap-3">
        {items.map((item, index) => (
          <div key={item} className="flex flex-1 items-center gap-3">
            <div className="flex min-h-24 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-[#f8fafc] px-3 text-center text-sm font-black text-[#06172f]">
              {item}
            </div>
            {index < items.length - 1 ? <ArrowRight className="h-5 w-5 shrink-0 text-[#1f8a5b]" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PillarGrid({ pillars }: { pillars: readonly { title: string; detail: string }[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {pillars.map((pillar, index) => (
        <article key={pillar.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#d9a441]/15 text-sm font-black text-[#8a650f]">{String(index + 1).padStart(2, "0")}</span>
          <h3 className="mt-5 text-lg font-black text-[#06172f]">{pillar.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.detail}</p>
        </article>
      ))}
    </div>
  );
}

export function ClusterCard({ cluster }: { cluster: LcdboClusterCard }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f8a5b]">{cluster.clusterType}</p>
          <h3 className="mt-2 text-xl font-black leading-tight text-[#06172f]">{cluster.name}</h3>
        </div>
        <span className="rounded-full bg-[#d9a441]/15 px-3 py-1 text-xs font-black capitalize text-[#72520c]">{cluster.status}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{cluster.description}</p>
      <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{cluster.sector}</p>
      <div className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
        <MapPin className="h-4 w-4 text-[#1f8a5b]" />
        {cluster.state} / {cluster.lga}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric label="Investment" value={formatNairaCompact(cluster.investmentRequired)} />
        <Metric label="MSMEs" value={cluster.msmeTarget?.toLocaleString("en-NG") ?? "TBC"} />
        <Metric label="Jobs" value={cluster.jobsTarget?.toLocaleString("en-NG") ?? "TBC"} />
      </div>
      <Link href={`/dashboard/msme/lcdbo?cluster=${encodeURIComponent(cluster.id)}`} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#008751]">Express interest <ArrowRight className="h-4 w-4" /></Link>
    </article>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-[#06172f]">{value}</p>
    </div>
  );
}

export function PartnerCard({ partner }: { partner: LcdboPartnerCard }) {
  const initials = partner.name.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]).join("").toUpperCase();
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#0B2E59] text-xs font-black tracking-wider text-white">{initials}</span><p className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#008751]">{partner.category}</p></div>
      <h3 className="mt-3 text-xl font-black text-[#06172f]">{partner.name}</h3>
      <p className="mt-1 text-xs font-bold capitalize text-slate-500">{partner.institutionType}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{partner.description}</p>
      {partner.website ? (
        <Link href={partner.website} className="mt-4 inline-flex text-sm font-black text-[#0d5f42]">
          Visit partner
        </Link>
      ) : null}
    </article>
  );
}

export function MapPlaceholder({ clusters }: { clusters: LcdboClusterCard[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#06172f] p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#f2c76b]">Cluster geography</p>
          <h3 className="mt-1 text-2xl font-black">Pilot footprint map</h3>
        </div>
        <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold text-slate-300">Map integration pending</span>
      </div>
      <div className="relative mt-6 min-h-72 overflow-hidden rounded-xl border border-white/10 bg-[#092442]">
        <div className="absolute inset-6 rounded-[40%] border border-[#1f8a5b]/50 bg-[#1f8a5b]/10" />
        {clusters.map((cluster, index) => (
          <div
            key={cluster.id}
            className="absolute rounded-full border-4 border-[#092442] bg-[#d9a441] shadow-lg shadow-black/30"
            style={{
              left: `${22 + index * 24}%`,
              top: `${34 + (index % 2) * 25}%`,
              width: `${18 + index * 4}px`,
              height: `${18 + index * 4}px`,
            }}
            title={cluster.name}
          />
        ))}
        <div className="absolute bottom-4 left-4 right-4 grid gap-2 sm:grid-cols-3">
          {clusters.map((cluster) => (
            <div key={cluster.id} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-slate-200">
              {cluster.state}: {cluster.sector}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
