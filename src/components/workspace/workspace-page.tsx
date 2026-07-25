import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, FileText, Loader2, Search, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { workspaceClassification, type WorkspaceDataClassificationMeta } from "@/lib/workspaces/workspace-classification";

type ActionLink = {
  label: string;
  href: string;
};

export function WorkspacePage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl space-y-6 ${className}`}>{children}</div>;
}

export function WorkspaceSection({ children, title, description, actions }: { children: ReactNode; title?: string; description?: string; actions?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6">
      {(title || description || actions) ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-xl font-black tracking-tight text-[#0c1733]">{title}</h2> : null}
            {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function WorkspacePageHeader({
  eyebrow,
  title,
  description,
  disclosure,
  classification,
  actions,
  breadcrumbs,
  lastUpdated,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  disclosure?: string;
  classification?: WorkspaceDataClassificationMeta;
  actions?: ReactNode;
  breadcrumbs?: ActionLink[];
  lastUpdated?: string;
}) {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6">
      {breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
          {breadcrumbs.map((item, index) => (
            <span key={item.href} className="inline-flex items-center gap-2">
              {index ? <ArrowRight className="h-3 w-3 text-slate-400" /> : null}
              <Link href={item.href} className="hover:text-slate-900">{item.label}</Link>
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p> : null}
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#0c1733] sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {classification ? <WorkspaceDataClassificationBadge classification={classification} /> : null}
            {lastUpdated ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Updated {lastUpdated}</span> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {disclosure ? <WorkspaceDisclosure>{disclosure}</WorkspaceDisclosure> : null}
    </header>
  );
}

export function WorkspaceDataClassificationBadge({ classification }: { classification: WorkspaceDataClassificationMeta }) {
  const meta = workspaceClassification(classification);
  const tone = {
    operational: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    reference: "bg-sky-50 text-sky-800 ring-sky-200",
    estimate: "bg-amber-50 text-amber-900 ring-amber-200",
    target: "bg-purple-50 text-purple-800 ring-purple-200",
    aggregate: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    public: "bg-slate-100 text-slate-700 ring-slate-200",
    external: "bg-cyan-50 text-cyan-800 ring-cyan-200",
    unavailable: "bg-rose-50 text-rose-800 ring-rose-200",
  }[meta.classification];
  return <span title={meta.description} className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${tone}`}>{meta.label}</span>;
}

export function WorkspaceDisclosure({ children }: { children: ReactNode }) {
  return <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{children}</div>;
}

export function WorkspaceState({
  type,
  title,
  description,
  action,
}: {
  type: "loading" | "empty" | "unavailable" | "unauthorized" | "error" | "filtered-zero" | "not-configured";
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon: LucideIcon = type === "loading" ? Loader2 : type === "filtered-zero" ? Search : type === "unauthorized" ? ShieldAlert : type === "error" || type === "unavailable" ? AlertTriangle : FileText;
  return (
    <div role={type === "error" ? "alert" : "status"} className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <Icon className={`mx-auto h-8 w-8 text-slate-400 ${type === "loading" ? "animate-spin" : ""}`} />
      <h2 className="mt-4 text-lg font-black text-[#0c1733]">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function WorkspaceToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}

export function WorkspaceContentGrid({ children, columns = "lg:grid-cols-3" }: { children: ReactNode; columns?: string }) {
  return <div className={`grid gap-4 sm:grid-cols-2 ${columns}`}>{children}</div>;
}
