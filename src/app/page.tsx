import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const stakeholderCards = [
  { title: "MSMEs", text: "Rapid onboarding, digital ID issuance, and visible compliance posture." },
  { title: "Regulators", text: "Unified oversight for KYC simulation, enforcement, and tax readiness." },
  { title: "Associations", text: "Membership governance and sector/state coordination tools." },
  { title: "Public", text: "Trusted verification with QR-backed registry status checks." },
];

export default async function LandingPage() {
  const supabase = await createServerSupabaseClient();
  const [{ count: msmeCount }, { count: issuedCount }, { count: validatedCount }] = await Promise.all([
    supabase.from("msmes").select("*", { count: "exact", head: true }),
    supabase.from("digital_ids").select("*", { count: "exact", head: true }),
    supabase.from("validation_results").select("*", { count: "exact", head: true }),
  ]);

  return (
    <main className="bg-slate-50">
      <Navbar />
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-10 text-white shadow-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Federal civic-tech infrastructure</p>
          <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-5xl">Nigeria Digital MSME Identity Infrastructure Initiative (NDMII)</h1>
          <p className="mt-4 max-w-2xl text-base text-slate-200">Government-grade onboarding, identity issuance, validation simulation, and public trust verification in one platform.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register"><Button>Start onboarding</Button></Link>
            <Link href="/verify"><Button variant="secondary">Verify MSME ID</Button></Link>
            <Link href="/dashboard"><Button variant="secondary">Open dashboards</Button></Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs uppercase text-slate-500">Registry count</p><p className="text-3xl font-semibold">{(msmeCount ?? 0).toLocaleString()}</p><p className="text-xs text-slate-500">MSMEs onboarded</p></article>
          <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs uppercase text-slate-500">Digital IDs issued</p><p className="text-3xl font-semibold">{(issuedCount ?? 0).toLocaleString()}</p><p className="text-xs text-slate-500">Active registry records</p></article>
          <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs uppercase text-slate-500">Validation snapshots</p><p className="text-3xl font-semibold">{(validatedCount ?? 0).toLocaleString()}</p><p className="text-xs text-slate-500">KYC simulation entries</p></article>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Digital ID preview</h2>
            <div className="mt-3 rounded-xl border bg-slate-900 p-4 text-slate-100">
              <p className="text-xs uppercase tracking-wider text-emerald-300">Issuer authority</p>
              <p className="mt-1 text-lg font-semibold">Federal MSME Identity Registry</p>
              <p className="mt-2 text-sm">NDMII-LAG-004231 • Validation badges: CAC, NIN, BVN, TIN</p>
              <p className="mt-2 text-xs text-slate-300">QR-backed verification endpoint and compliance visibility for public trust checks.</p>
            </div>
          </article>
          <article className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Trust indicators</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>• Simulated adapter integrations for CAC/NIN/BVN/TIN.</li>
              <li>• Validation status visible across reviewer, admin, MSME, and public views.</li>
              <li>• End-to-end audit logs for regulator-ready traceability.</li>
            </ul>
          </article>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stakeholderCards.map((card) => (
            <article key={card.title} className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{card.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Link href="/register" className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className="text-sm font-semibold">MSME onboarding CTA</p>
            <p className="text-xs text-slate-600">Launch onboarding wizard</p>
          </Link>
          <Link href="/verify" className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className="text-sm font-semibold">Public verify CTA</p>
            <p className="text-xs text-slate-600">Check digital ID authenticity</p>
          </Link>
          <Link href="/dashboard/compliance" className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className="text-sm font-semibold">Compliance CTA</p>
            <p className="text-xs text-slate-600">Open KYC simulation matrix</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
