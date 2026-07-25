import type { ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { WorkspaceState } from "@/components/workspace/workspace-page";

export type WorkspaceTableColumn<Row> = {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  className?: string;
};

export function WorkspaceFilterBar({
  children,
  clearHref,
  appliedFilters = [],
}: {
  children: ReactNode;
  clearHref?: string;
  appliedFilters?: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {appliedFilters.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
          <span>Applied:</span>
          {appliedFilters.map((filter) => <span key={filter} className="rounded-full bg-slate-100 px-2.5 py-1">{filter}</span>)}
          {clearHref ? <Link href={clearHref} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700"><X className="h-3 w-3" />Clear</Link> : null}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceDataTable<Row>({
  rows,
  columns,
  getRowKey,
  emptyTitle = "No records available",
  emptyDescription = "No operational records are available for this view.",
}: {
  rows: Row[];
  columns: WorkspaceTableColumn<Row>[];
  getRowKey: (row: Row, index: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!rows.length) return <WorkspaceState type="empty" title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => <th key={column.key} scope="col" className={`px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500 ${column.className ?? ""}`}>{column.header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)} className="align-top transition hover:bg-slate-50">
              {columns.map((column) => <td key={column.key} className={`px-4 py-3 text-slate-700 ${column.className ?? ""}`}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorkspacePagination({
  page,
  totalPages,
  previousHref,
  nextHref,
  summary,
}: {
  page: number;
  totalPages: number;
  previousHref?: string;
  nextHref?: string;
  summary?: string;
}) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <p className="font-bold text-slate-600">{summary ?? `Page ${page} of ${totalPages}`}</p>
      <div className="flex gap-2">
        {previousHref ? <Link href={previousHref} className="rounded-xl border border-slate-200 px-3 py-2 font-black text-slate-700 hover:bg-slate-50">Previous</Link> : <span className="rounded-xl border border-slate-100 px-3 py-2 font-black text-slate-300">Previous</span>}
        {nextHref ? <Link href={nextHref} className="rounded-xl border border-slate-200 px-3 py-2 font-black text-slate-700 hover:bg-slate-50">Next</Link> : <span className="rounded-xl border border-slate-100 px-3 py-2 font-black text-slate-300">Next</span>}
      </div>
    </nav>
  );
}
