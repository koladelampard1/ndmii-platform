import Link from "next/link";
import { getCorrespondenceRegister, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceRegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireLcdboCorrespondenceAccess("view");
  const page = Number(params.page ?? 1);
  const register = await getCorrespondenceRegister({
    q: String(params.q ?? ""),
    status: String(params.status ?? ""),
    direction: String(params.direction ?? ""),
    issuer: String(params.issuer ?? ""),
    page,
  }, supabase);
  const totalPages = Math.max(1, Math.ceil(register.total / register.pageSize));

  return (
    <div className="space-y-6">
      <WorkspaceCard title="Correspondence register" description="Search and filter all governed incoming and outgoing LCDBO correspondence.">
        <form className="grid gap-3 md:grid-cols-5">
          <input name="q" defaultValue={String(params.q ?? "")} placeholder="Search reference or subject" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
          <select name="status" defaultValue={String(params.status ?? "")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {["draft", "in_review", "awaiting_approval", "awaiting_signature", "sent", "closed"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <select name="direction" defaultValue={String(params.direction ?? "")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Both directions</option>
            <option value="OUT">Outgoing</option>
            <option value="IN">Incoming</option>
          </select>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Apply filters</button>
        </form>
        <div className="mt-5">
          <CorrespondenceTable records={register.records} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>Showing {register.records.length ? (register.page - 1) * register.pageSize + 1 : 0}–{Math.min(register.total, register.page * register.pageSize)} of {register.total}</span>
          <div className="flex gap-2">
            <Link aria-disabled={register.page <= 1} href={`/dashboard/correspondence/register?page=${Math.max(1, register.page - 1)}`} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold">Previous</Link>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-bold">Page {register.page} of {totalPages}</span>
            <Link aria-disabled={register.page >= totalPages} href={`/dashboard/correspondence/register?page=${Math.min(totalPages, register.page + 1)}`} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold">Next</Link>
          </div>
        </div>
      </WorkspaceCard>
    </div>
  );
}
