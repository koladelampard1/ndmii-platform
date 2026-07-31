import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { StateRevenueApplicationForm } from "@/components/state-revenue/application-form";
import { submitEkirsExistingApplicationAction } from "@/app/ekirs/apply/actions";
import { listOwnedStateRevenueBusinesses } from "@/lib/state-revenue/onboarding";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";
import { StateRevenuePublicShell } from "@/components/state-revenue/state-revenue-components";

export const metadata = {
  title: "Existing DBIN Business EKIRS Application | DBIN",
};

export default async function EkirsExistingApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [ctx, params] = await Promise.all([getCurrentUserContext().catch(() => null), searchParams]);

  if (!ctx?.appUserId) {
    return (
      <StateRevenuePublicShell config={EKIRS_JURISDICTION}>
      <section className="px-5 py-16 text-slate-950 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Existing DBIN business</p>
          <h1 className="mt-3 text-3xl font-black">Sign in to continue</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Existing businesses must authenticate so the application can be linked without creating a duplicate DBIN identity.
          </p>
          <Link href="/login?workspace=ekirs&next=/ekirs/apply/existing" className="mt-6 inline-flex rounded-full bg-emerald-700 px-6 py-3 text-sm font-black text-white hover:bg-emerald-800">Sign in</Link>
        </div>
      </section>
      </StateRevenuePublicShell>
    );
  }

  const supabase = await createServiceRoleSupabaseClient();
  const businesses = await listOwnedStateRevenueBusinesses({ ctx, jurisdictionId: "ekiti", client: supabase });

  return (
    <StateRevenuePublicShell config={EKIRS_JURISDICTION}>
      <section className="bg-[#0b2d26] px-6 py-12 text-white lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-200">Existing business application</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Add Ekiti jurisdiction participation</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-emerald-50">
            Your canonical DBIN identity is preserved. This application verifies the Ekiti operating location and jurisdiction relationship only.
          </p>
        </div>
      </section>
      <StateRevenueApplicationForm action={submitEkirsExistingApplicationAction} mode="existing_business" error={params.error} ownedBusinesses={businesses} />
    </StateRevenuePublicShell>
  );
}
