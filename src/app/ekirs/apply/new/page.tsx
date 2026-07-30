import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth/session";
import { StateRevenueApplicationForm } from "@/components/state-revenue/application-form";
import { submitEkirsNewApplicationAction } from "@/app/ekirs/apply/actions";

export const metadata = {
  title: "New EKIRS Business Application | DBIN",
};

export default async function EkirsNewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [ctx, params] = await Promise.all([getCurrentUserContext().catch(() => null), searchParams]);
  if (!ctx?.appUserId) {
    return (
      <main className="min-h-screen bg-[#f6faf7] px-6 py-16 text-slate-950 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">New business application</p>
          <h1 className="mt-3 text-3xl font-black">Sign in to save and resume</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            EKIRS onboarding uses authenticated save-and-resume until a live email verification provider is configured. No fake OTP or public draft links are used.
          </p>
          <Link href="/login?workspace=ekirs&next=/ekirs/apply/new" className="mt-6 inline-flex rounded-full bg-emerald-700 px-6 py-3 text-sm font-black text-white hover:bg-emerald-800">Sign in</Link>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#f6faf7] text-slate-950">
      <section className="bg-[#0b2d26] px-6 py-12 text-white lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-200">New business application</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Apply for EKIRS onboarding</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-emerald-50">
            This controlled UAT application checks Ekiti operating presence before any canonical DBIN identity is created.
          </p>
        </div>
      </section>
      <StateRevenueApplicationForm action={submitEkirsNewApplicationAction} mode="new_business" error={params.error} />
    </main>
  );
}
