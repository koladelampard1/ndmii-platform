import Link from "next/link";
import { lookupEkirsApplicationStatusAction } from "@/app/ekirs/apply/actions";
import { lookupStateRevenueApplicationStatus } from "@/lib/state-revenue/onboarding";

export const metadata = {
  title: "EKIRS Application Status | DBIN",
};

export default async function EkirsApplicationStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; email?: string; submitted?: string; lookup?: string; status?: string; error?: string }>;
}) {
  const params = await searchParams;
  const result = params.reference && params.email
    ? await lookupStateRevenueApplicationStatus({ jurisdictionId: "ekiti", reference: params.reference, email: params.email }).catch(() => null)
    : null;
  const status = result?.current_status ?? params.status ?? null;

  return (
    <main className="min-h-screen bg-[#f6faf7] px-6 py-14 text-slate-950 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Application status</p>
          <h1 className="mt-3 text-3xl font-black">Track EKIRS onboarding</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Status lookup requires both the application reference and the submitted contact email. Evidence and reviewer notes are never exposed here.
          </p>
          {params.submitted && params.reference ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-black">Application received</p>
              <p className="mt-1">Reference: <span className="font-black">{params.reference}</span></p>
              <p className="mt-1">Keep this reference for support and status lookup.</p>
              <Link href={`/ekirs/apply/resume/${encodeURIComponent(params.reference)}`} className="mt-3 inline-flex rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white">Resume or upload evidence</Link>
            </div>
          ) : null}
          {params.lookup === "not_found" ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">No matching application was found for that reference and email combination.</div>
          ) : null}
          {status ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Current status</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{status.replace(/_/g, " ")}</p>
              {result?.decision_notes ? <p className="mt-2 text-sm leading-6 text-slate-600">{result.decision_notes}</p> : null}
            </div>
          ) : null}
        </section>
        <form action={lookupEkirsApplicationStatusAction} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Application reference
            <input name="application_reference" defaultValue={params.reference ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" required />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Contact email
            <input name="contact_email" type="email" defaultValue={params.email ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" required />
          </label>
          <button type="submit" className="self-end rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800">Check status</button>
        </form>
        <Link href="/ekirs/apply" className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Back to application options</Link>
      </div>
    </main>
  );
}
