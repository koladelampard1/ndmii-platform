import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { openAssociationMemberInvite } from "@/lib/data/admin-association-member-actions";

export const dynamic = "force-dynamic";

export default async function AssociationOnboardingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ started?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const supabase = await createServiceRoleSupabaseClient();
  const result = await openAssociationMemberInvite(supabase, token);

  async function continueOnboarding() {
    "use server";
    const actionClient = await createServiceRoleSupabaseClient();
    const actionResult = await openAssociationMemberInvite(actionClient, token, true);
    if (!actionResult.ok) redirect(`/association-onboarding/${token}`);
    redirect(`/association-onboarding/${token}?started=1`);
  }

  if (!result.ok) {
    return <main className="mx-auto max-w-xl px-6 py-16"><section className="rounded-2xl border bg-white p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-rose-700">Association onboarding</p><h1 className="mt-2 text-2xl font-black">Invitation unavailable</h1><p className="mt-3 text-sm text-slate-600">{result.error}</p></section></main>;
  }

  return <main className="mx-auto max-w-xl px-6 py-16"><section className="rounded-2xl border bg-white p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Association onboarding</p><h1 className="mt-2 text-2xl font-black">Continue your DBIN onboarding</h1><p className="mt-2 text-sm text-slate-600">Your approved association membership is ready for the next onboarding step. No account, MSME credential, or verification has been issued automatically.</p><div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm"><p><strong>Association:</strong> {result.member.associationName ?? "Association unavailable"}</p><p><strong>Member:</strong> {result.member.fullName ?? "Member"}</p><p><strong>Business:</strong> {result.member.businessName ?? "Business details pending"}</p><p><strong>Trade:</strong> {result.member.tradeType ?? "Trade details pending"}</p><p><strong>LGA:</strong> {result.member.lga ?? "LGA pending"}</p></div>{query.started ? <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Onboarding has started. Account creation will be connected to the approved authentication flow in a later step.</p> : <form action={continueOnboarding} className="mt-5"><button className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white">Continue onboarding</button></form>}</section></main>;
}
