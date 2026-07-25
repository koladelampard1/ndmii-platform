import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import type { WorkspaceDataClassificationMeta } from "@/lib/workspaces/workspace-classification";
import { WorkspaceDataClassificationBadge } from "@/components/workspace/workspace-page";

export type WorkspaceReportCard = {
  title: string;
  description: string;
  category?: string;
  href?: string;
  csvHref?: string;
  pdfHref?: string;
  status?: string;
  period?: string;
  lastGenerated?: string;
  classification?: WorkspaceDataClassificationMeta;
};

export function WorkspaceReportCatalogue({ reports, emptyState }: { reports: WorkspaceReportCard[]; emptyState?: ReactNode }) {
  if (!reports.length) return <>{emptyState}</>;
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => <WorkspaceReportCardView key={`${report.title}-${report.href ?? report.csvHref ?? report.pdfHref}`} report={report} />)}
    </section>
  );
}

export function WorkspaceReportCardView({ report }: { report: WorkspaceReportCard }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          {report.category ? <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{report.category}</p> : null}
          <h2 className="mt-2 text-xl font-black text-[#0c1733]">{report.title}</h2>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white"><FileText className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{report.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {report.classification ? <WorkspaceDataClassificationBadge classification={report.classification} /> : null}
        {report.status ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{report.status}</span> : null}
        {report.period ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{report.period}</span> : null}
      </div>
      {report.lastGenerated ? <p className="mt-3 text-xs font-bold text-slate-500">Last generated: {report.lastGenerated}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {report.href ? <Link href={report.href} className="inline-flex items-center gap-2 rounded-xl bg-[#0c1733] px-3 py-2 text-sm font-black text-white">Open <ArrowRight className="h-4 w-4" /></Link> : null}
        {report.csvHref ? <Link href={report.csvHref} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">CSV</Link> : null}
        {report.pdfHref ? <Link href={report.pdfHref} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">PDF</Link> : null}
      </div>
    </article>
  );
}
