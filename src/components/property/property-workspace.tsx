import Link from "next/link";
import type React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2, Clock3, FileText, Home, ShieldCheck } from "lucide-react";
import type { Property, PropertyAddress } from "@/types/property";

export function PropertyWorkspaceHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: Array<{ href: string; label: string; primary?: boolean }>;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[#06172f] text-white shadow-xl">
      <div className="relative px-5 py-8 sm:px-8 lg:px-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f2c76b]">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{description}</p>
          </div>
          {actions?.length ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={
                    action.primary
                      ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-4 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]"
                      : "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                  }
                >
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function PropertyMetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string | number; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-[#06172f]">{value}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-[#008751]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

export function PropertyStatusBadge({ status }: { status: string }) {
  const tone = ["verified", "active"].includes(status)
    ? "bg-emerald-100 text-emerald-800"
    : ["submitted", "under_review"].includes(status)
      ? "bg-amber-100 text-amber-900"
      : ["disputed", "cancelled", "rejected"].includes(status)
        ? "bg-rose-100 text-rose-800"
        : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

export function PropertyProgress({ currentStep }: { currentStep: number }) {
  const steps = ["Type", "Details", "Location", "Ownership", "Documents", "Review"];
  return (
    <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const active = stepNumber === currentStep;
        const done = stepNumber < currentStep;
        return (
          <li
            key={step}
            className={`rounded-2xl border p-3 ${
              active
                ? "border-[#008751] bg-emerald-50 text-[#06172f]"
                : done
                  ? "border-emerald-200 bg-white text-[#008751]"
                  : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${done ? "bg-[#008751] text-white" : active ? "bg-[#06172f] text-white" : "bg-slate-100 text-slate-500"}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : stepNumber}
              </span>
              <span className="text-sm font-black">{step}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PropertyTable({ properties, emptyTitle, emptyDetail }: { properties: Array<Property & { primaryAddress?: PropertyAddress | null }>; emptyTitle: string; emptyDetail: string }) {
  if (!properties.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <Home className="mx-auto h-9 w-9 text-slate-400" />
        <h2 className="mt-4 text-xl font-black text-[#06172f]">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-slate-500">{emptyDetail}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-5 py-4">Property</th>
              <th className="px-5 py-4">Location</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Application Ref</th>
              <th className="px-5 py-4">Last updated</th>
              <th className="px-5 py-4">NPIN</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {properties.map((property) => (
              <tr key={property.id} className="align-top">
                <td className="px-5 py-4">
                  <p className="font-black text-[#06172f]">{property.title || humanize(property.property_type)}</p>
                  <p className="mt-1 text-xs capitalize text-slate-500">{property.property_type.replaceAll("_", " ")}</p>
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {property.primaryAddress?.traditional_description || [property.primaryAddress?.plot, property.primaryAddress?.block, property.primaryAddress?.street].filter(Boolean).join(", ") || "Location pending"}
                </td>
                <td className="px-5 py-4"><PropertyStatusBadge status={property.status} /></td>
                <td className="px-5 py-4 text-slate-600">{property.application_reference || (property.status === "draft" ? "Generated on submit" : "Pending reference")}</td>
                <td className="px-5 py-4 text-slate-600">{formatDate(property.updated_at)}</td>
                <td className="px-5 py-4 font-bold text-slate-700">{property.npin || "Pending approval"}</td>
                <td className="px-5 py-4">
                  <Link href={`/dashboard/property/register?property=${property.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#06172f] px-3 py-2 text-xs font-black text-white">
                    {property.status === "draft" ? "Resume" : "View"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RegistrationGuide() {
  const items = [
    { icon: FileText, title: "Prepare evidence", detail: "Gather survey, title, allocation or supporting documents before submission." },
    { icon: Clock3, title: "Save as draft", detail: "You can save incomplete applications and return later before submitting." },
    { icon: ShieldCheck, title: "Submit for review", detail: "NPIN remains pending until a property enters the registry review pipeline." },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map(({ icon: Icon, title, detail }) => (
        <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Icon className="h-6 w-6 text-[#008751]" />
          <h3 className="mt-4 text-lg font-black text-[#06172f]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
        </article>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-black text-[#06172f]">
      {label}
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{hint}</p> : null}
    </label>
  );
}

export const inputClass = "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#008751] focus:ring-4 focus:ring-emerald-100";
export const textareaClass = "min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#008751] focus:ring-4 focus:ring-emerald-100";

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}
