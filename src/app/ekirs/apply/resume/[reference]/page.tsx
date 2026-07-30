import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StateRevenueApplicationForm } from "@/components/state-revenue/application-form";
import { submitEkirsNewApplicationAction, submitEkirsExistingApplicationAction, uploadEkirsApplicationEvidenceAction } from "@/app/ekirs/apply/actions";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getOwnedStateRevenueApplicationByReference, listOwnedStateRevenueBusinesses } from "@/lib/state-revenue/onboarding";

export const metadata = {
  title: "Resume EKIRS Application | DBIN",
};

const EVIDENCE_TYPES = [
  ["operating_location_photograph", "Operating-location photograph"],
  ["utility_bill", "Utility bill"],
  ["tenancy_or_occupancy", "Tenancy or occupancy evidence"],
  ["market_association_confirmation", "Market association confirmation"],
  ["trade_association_confirmation", "Trade association confirmation"],
  ["local_government_permit", "Local government permit"],
  ["shop_or_business_permit", "Shop or business permit"],
  ["cac_document", "CAC document"],
  ["tin_reference", "TIN/taxpayer reference"],
  ["field_verification_evidence", "Field-verification evidence"],
  ["other", "Other approved evidence"],
] as const;

export default async function EkirsResumeApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ error?: string; saved?: string; uploaded?: string }>;
}) {
  const [{ reference }, query, ctx, supabase] = await Promise.all([
    params,
    searchParams,
    getCurrentUserContext().catch(() => null),
    createServiceRoleSupabaseClient(),
  ]);
  if (!ctx?.appUserId) redirect(`/login?workspace=ekirs&next=/ekirs/apply/resume/${encodeURIComponent(reference)}`);
  const application = await getOwnedStateRevenueApplicationByReference({ reference, ctx, client: supabase });
  if (!application) notFound();
  const editable = ["draft", "evidence_required", "additional_information_required"].includes(application.current_status);
  const ownedBusinesses = application.application_type === "existing_business"
    ? await listOwnedStateRevenueBusinesses({ ctx, jurisdictionId: "ekiti", client: supabase })
    : [];

  return (
    <main className="min-h-screen bg-[#f6faf7] text-slate-950">
      <section className="bg-[#0b2d26] px-6 py-12 text-white lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-200">Save and resume</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Continue EKIRS application</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-emerald-50">
            Reference {application.application_reference}. Only the authenticated applicant can edit this application before final decision.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-5xl space-y-4 px-6 pt-8 lg:px-8">
        {query.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{decodeURIComponent(query.error)}</div> : null}
        {query.saved ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Draft saved.</div> : null}
        {query.uploaded ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Evidence uploaded securely.</div> : null}
        {!editable ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black text-slate-950">This application is no longer editable.</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">You can still track its status. Final decisions do not expose evidence or reviewer notes publicly.</p>
            <Link href={`/ekirs/apply/status?reference=${encodeURIComponent(application.application_reference)}`} className="mt-4 inline-flex rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">View status</Link>
          </div>
        ) : null}
      </div>
      {editable ? (
        <>
          <StateRevenueApplicationForm
            action={application.application_type === "existing_business" ? submitEkirsExistingApplicationAction : submitEkirsNewApplicationAction}
            mode={application.application_type}
            application={application}
            ownedBusinesses={ownedBusinesses}
            applicantResponse={application.current_status === "additional_information_required"}
          />
          <section className="mx-auto max-w-5xl px-6 pb-12 lg:px-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Secure evidence</p>
              <h2 className="mt-2 text-2xl font-black">Upload supporting evidence</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Files are stored in a private bucket. Public URLs are never shown.</p>
              <form action={uploadEkirsApplicationEvidenceAction} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="application_id" value={application.id} />
                <input type="hidden" name="application_reference" value={application.application_reference} />
                <select name="evidence_type" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" required>
                  <option value="">Select evidence type</option>
                  {EVIDENCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input name="evidence_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" required />
                <button className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800">Upload</button>
              </form>
              <div className="mt-5 grid gap-2">
                {application.evidence.length ? application.evidence.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div>
                      <p className="font-black text-slate-950">{item.evidence_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-slate-500">{item.original_filename ?? "Metadata only"} · {item.evidence_status.replace(/_/g, " ")}</p>
                    </div>
                    {item.storage_path ? <a href={`/api/ekirs/evidence/${item.id}`} target="_blank" rel="noreferrer" className="text-xs font-black text-emerald-700">Preview</a> : null}
                  </div>
                )) : <p className="text-sm text-slate-600">No evidence uploaded yet.</p>}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
