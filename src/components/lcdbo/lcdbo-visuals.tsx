import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, Circle, Factory, Globe2, Landmark, MapPinned, Sparkles } from "lucide-react";

export function LcdboStatusBadge({ status }: { status: string }) {
  const tone = ["active", "accepted", "placed", "completed"].includes(status)
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : ["rejected", "suspended", "inactive", "expired"].includes(status)
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : ["pending_review", "interested", "under_review", "waitlisted", "onboarding", "needs_documents", "submitted"].includes(status)
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold capitalize ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

export function LcdboCommandMetricCard({ icon: Icon, label, value, detail, attention = false }: { icon: LucideIcon; label: string; value: string | number; detail?: string; attention?: boolean }) {
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D4A017]/50 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B2E59]/[0.07] text-[#0B2E59]"><Icon className="h-5 w-5" /></span>
        {attention ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#D4A017] ring-4 ring-amber-100" /> : null}
      </div>
      <p className="mt-4 text-3xl font-black tracking-tight text-[#0B2E59]">{typeof value === "number" ? value.toLocaleString("en-NG") : value}</p>
      <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      {detail ? <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p> : null}
    </article>
  );
}

export function LcdboJourneyFlow({ items, completed = 0 }: { items: readonly string[]; completed?: number }) {
  return (
    <div className="overflow-x-auto pb-2">
      <ol className="flex min-w-[780px] items-start">
        {items.map((item, index) => {
          const done = index < completed;
          const current = index === completed;
          return (
            <li key={item} className="flex flex-1 items-start last:flex-none">
              <div className="w-28 text-center sm:w-32">
                <span className={`mx-auto grid h-10 w-10 place-items-center rounded-full border-2 ${done ? "border-[#008751] bg-[#008751] text-white" : current ? "border-[#D4A017] bg-amber-50 text-[#8a650f]" : "border-slate-200 bg-white text-slate-400"}`}>
                  {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-black">{index + 1}</span>}
                </span>
                <p className={`mt-2 text-xs font-bold leading-4 ${done || current ? "text-[#0B2E59]" : "text-slate-500"}`}>{item}</p>
              </div>
              {index < items.length - 1 ? <div className={`mt-5 h-0.5 min-w-6 flex-1 ${index < completed ? "bg-[#008751]" : "bg-slate-200"}`} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LcdboPipeline({ stages }: { stages: readonly { label: string; value: number }[] }) {
  const peak = Math.max(...stages.map((stage) => stage.value), 1);
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
      {stages.map((stage, index) => (
        <div key={stage.label} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
          <div className="absolute inset-x-0 bottom-0 bg-[#008751]/10" style={{ height: `${Math.max(8, (stage.value / peak) * 70)}%` }} />
          <div className="relative">
            <div className="flex items-center justify-between"><span className="text-[10px] font-black text-slate-400">{String(index + 1).padStart(2, "0")}</span>{index < stages.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-[#D4A017]" /> : <Check className="h-3.5 w-3.5 text-[#008751]" />}</div>
            <p className="mt-5 text-2xl font-black text-[#0B2E59]">{stage.value.toLocaleString("en-NG")}</p>
            <p className="mt-1 text-xs font-bold text-slate-600">{stage.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LcdboCoveragePanel({ states, clusters, enrolments, pending }: { states: number; clusters: number; enrolments: number; pending: number }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-[#0B2E59] text-white shadow-sm">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#e8bd4e]">National coverage</p>
          <h3 className="mt-2 text-2xl font-black">Programme footprint</h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">A consolidated view of where LCDBO participation demand and cluster operations are emerging.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[{ label: "States", value: states }, { label: "Clusters", value: clusters }, { label: "Enrolled MSMEs", value: enrolments }, { label: "Pending requests", value: pending }].map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.06] p-3"><p className="text-2xl font-black">{item.value}</p><p className="mt-1 text-xs text-slate-300">{item.label}</p></div>)}
          </div>
        </div>
        <div className="relative min-h-64 overflow-hidden rounded-2xl border border-white/10 bg-[#082441]" aria-label="Stylised Nigeria programme coverage map">
          <div className="absolute left-[22%] top-[12%] h-[72%] w-[58%] rotate-[-7deg] rounded-[42%_58%_54%_46%/44%_36%_64%_56%] border border-emerald-400/30 bg-emerald-500/10" />
          {["left-[36%] top-[28%]", "left-[57%] top-[38%]", "left-[43%] top-[58%]", "left-[64%] top-[66%]"].map((position, index) => <span key={position} className={`absolute ${position} grid h-8 w-8 place-items-center rounded-full border-4 border-[#082441] bg-[#D4A017] text-[10px] font-black text-[#0B2E59] shadow-lg`}>{index + 1}</span>)}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><MapPinned className="h-4 w-4 text-emerald-300" />Coverage expands with programme activation</div>
        </div>
      </div>
    </article>
  );
}

export function LcdboSicipTeaser() {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#D4A017]/30 bg-gradient-to-br from-[#0B2E59] via-[#123d6e] to-[#071d38] p-6 text-white shadow-lg sm:p-8">
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#D4A017]/20 blur-2xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#efc85d]"><Sparkles className="h-4 w-4" />Coming soon</p>
          <h3 className="mt-2 text-2xl font-black sm:text-3xl">Special Industrial Clusters Investment Programme</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">SICIP will provide the investment mobilisation layer for industrial cluster development, strategic investors, project pipelines and funding partnerships.</p>
        </div>
        <div className="flex shrink-0 gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-white/10"><Landmark className="h-5 w-5 text-[#efc85d]" /></span><span className="grid h-12 w-12 place-items-center rounded-xl bg-white/10"><Globe2 className="h-5 w-5 text-emerald-300" /></span><span className="grid h-12 w-12 place-items-center rounded-xl bg-white/10"><Factory className="h-5 w-5 text-white" /></span></div>
      </div>
    </article>
  );
}

export function LcdboEmptyState({ title, detail, icon: Icon = Circle }: { title: string; detail: string; icon?: LucideIcon }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-slate-400 shadow-sm"><Icon className="h-5 w-5" /></span><h3 className="mt-4 font-black text-[#0B2E59]">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{detail}</p></div>;
}
