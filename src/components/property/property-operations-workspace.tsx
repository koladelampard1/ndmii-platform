import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Clock3, FileWarning } from "lucide-react";
import { PropertyStatusBadge } from "@/components/property/property-workspace";
import type { PropertyCaseDetail, PropertyCaseListItem } from "@/lib/property/property-operations-service";

export function RegistryOperationsHero({
  eyebrow = "Registry operations",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: Array<{ href: string; label: string; primary?: boolean }>;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[#06172f] text-white shadow-xl">
      <div className="relative px-5 py-8 sm:px-8 lg:px-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f2c76b]">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{description}</p>
          </div>
          {actions?.length ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              {actions.map((action) => (
                <Link key={action.href} href={action.href} className={action.primary ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#D4A017] px-4 text-sm font-black text-[#06172f]" : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-black text-white"}>
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function RegistryMetric({ label, value, detail, tone = "emerald" }: { label: string; value: string | number; detail: string; tone?: "emerald" | "amber" | "rose" | "slate" }) {
  const iconTone = tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "rose" ? "bg-rose-50 text-rose-700" : tone === "slate" ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-[#008751]";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-[#06172f]">{value}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${iconTone}`}>
          <BriefcaseBusiness className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

export function RegistryCaseTable({ cases, empty = "No registry cases found." }: { cases: PropertyCaseListItem[]; empty?: string }) {
  if (!cases.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <FileWarning className="mx-auto h-9 w-9 text-slate-400" />
        <h2 className="mt-4 text-xl font-black text-[#06172f]">{empty}</h2>
        <p className="mt-2 text-sm text-slate-500">Submitted property applications will appear here after registry case creation.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-5 py-4">Case</th>
              <th className="px-5 py-4">Application</th>
              <th className="px-5 py-4">Property</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Updated</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-5 py-4">
                  <p className="font-black text-[#06172f]">{item.case_reference}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.priority} priority</p>
                </td>
                <td className="px-5 py-4 text-slate-600">{item.application_reference ?? "—"}</td>
                <td className="px-5 py-4">
                  <p className="font-bold text-[#06172f]">{item.property?.title || item.property?.property_type?.replaceAll("_", " ") || "Property record"}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.property?.npin || "NPIN pending"}</p>
                </td>
                <td className="px-5 py-4"><PropertyStatusBadge status={item.status} /></td>
                <td className="px-5 py-4 text-slate-600">{formatDate(item.updated_at)}</td>
                <td className="px-5 py-4">
                  <Link href={`/dashboard/property/review/${item.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#06172f] px-3 py-2 text-xs font-black text-white">
                    Review
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

export function CaseSummaryCards({ detail }: { detail: PropertyCaseDetail }) {
  const acceptedDocuments = detail.documents.filter((document) => document.status === "accepted").length;
  const verifiedOwners = detail.owners.filter((owner) => owner.verification_status === "verified").length;
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <RegistryMetric label="Documents" value={`${acceptedDocuments}/${detail.documents.length}`} detail="Accepted supporting documents" />
      <RegistryMetric label="Owners" value={`${verifiedOwners}/${detail.owners.length}`} detail="Verified ownership records" />
      <RegistryMetric label="Assignments" value={detail.assignments.filter((item) => item.status === "active").length} detail="Active officer assignments" tone="amber" />
      <RegistryMetric label="Credentials" value={detail.credentials.filter((item) => item.status === "issued").length} detail="Issued property credentials" tone="slate" />
    </section>
  );
}

export function Timeline({ detail }: { detail: PropertyCaseDetail }) {
  const items = [
    ...detail.events.map((event) => ({ label: event.event_type, detail: event.summary, date: event.created_at, icon: Clock3 })),
    ...detail.statusHistory.map((event) => ({ label: `status.${event.new_status}`, detail: event.change_reason, date: event.created_at, icon: BadgeCheck })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 24);
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={`${item.label}-${item.date}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#008751]"><Icon className="h-5 w-5" /></span>
            <div>
              <p className="font-black text-[#06172f]">{item.label.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm text-slate-600">{item.detail || "Registry activity recorded."}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{formatDateTime(item.date)}</p>
            </div>
          </div>
        );
      })}
      {!items.length ? <p className="text-sm text-slate-500">No timeline events yet.</p> : null}
    </div>
  );
}

export function CertificatePreview({ detail }: { detail: PropertyCaseDetail }) {
  const certificate = detail.certificates[0];
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">Digital Land & Property Infrastructure</p>
          <h2 className="mt-2 text-3xl font-black text-[#06172f]">Property Registration Certificate</h2>
          <p className="mt-2 text-sm text-slate-500">{certificate?.certificate_reference ?? "Generate certificate after credential issuance"}</p>
        </div>
        <span className="grid h-20 w-20 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-center text-xs font-black text-slate-500">QR<br />PLACEHOLDER</span>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <CertificateField label="Application Reference" value={detail.property.application_reference ?? "—"} />
        <CertificateField label="Case Reference" value={detail.case_reference} />
        <CertificateField label="NPIN" value={detail.property.npin ?? "Pending"} />
        <CertificateField label="Registry Authority" value="Digital Land & Property Infrastructure Registry" />
        <CertificateField label="Property" value={detail.property.title || detail.property.property_type.replaceAll("_", " ")} />
        <CertificateField label="Owners" value={detail.owners.map((owner) => owner.owner_name).filter(Boolean).join(", ") || "Owner records pending"} />
      </div>
      <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Official disclaimer: This certificate is generated from registry operations records. Public online verification is intentionally not enabled in this phase.
      </div>
    </section>
  );
}

function CertificateField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 font-black text-[#06172f]">{value}</p>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}
