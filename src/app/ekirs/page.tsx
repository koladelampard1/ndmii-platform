import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, DatabaseZap, MapPinned, ShieldCheck } from "lucide-react";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";
import { getEkirsMetrics } from "@/lib/state-revenue/ekirs-demo-data";
import { StateRevenueDisclosure } from "@/components/state-revenue/state-revenue-components";

const staffLoginHref = "/login?workspace=ekirs&next=/dashboard/ekirs";

export const metadata: Metadata = {
  title: "Ekiti Business Formalisation and Revenue Readiness Platform | DBIN",
  description: "A controlled EKIRS workspace foundation for Ekiti business formalisation, jurisdiction eligibility, verification readiness and integration planning.",
  alternates: {
    canonical: "https://ekirs.dbin.ng/",
  },
  openGraph: {
    title: "Ekiti Business Formalisation and Revenue Readiness Platform",
    description: "A privacy-safe state revenue service foundation for business formalisation and readiness.",
    url: "https://ekirs.dbin.ng/",
    type: "website",
  },
};

export default function EkirsLandingPage() {
  const metrics = getEkirsMetrics();
  const pillars = [
    { icon: ShieldCheck, title: "Jurisdiction eligibility", description: "Confirm declared Ekiti operating context through address, LGA, consent-backed evidence and review policy." },
    { icon: Building2, title: "Business formalisation", description: "Guide enterprises from self-declared records to verified business identity and readiness support." },
    { icon: MapPinned, title: "LGA intelligence", description: "View privacy-safe operating patterns across Ekiti’s constitutional LGAs without exposing private taxpayer data." },
    { icon: DatabaseZap, title: "Integration readiness", description: "Prepare identity, TIN, CAC reference, field verification and notification integrations without live revenue feeds." },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6faf7] text-slate-950">
      <section className="relative overflow-hidden bg-[#0b2d26] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(132,204,22,0.22),transparent_34%),linear-gradient(135deg,rgba(11,45,38,1),rgba(9,25,35,1))]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div className="min-w-0">
            <p className="max-w-full text-xs font-black uppercase tracking-[0.14em] text-lime-200 sm:tracking-[0.22em]">EKIRS × DBIN State Revenue Framework</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Ekiti Business Formalisation and Revenue Readiness Platform
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50">
              A controlled institutional workspace foundation for Ekiti business identity, eligibility review, taxpayer readiness support and privacy-safe operating intelligence.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={staffLoginHref} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-emerald-950 transition hover:-translate-y-0.5 hover:bg-lime-200 sm:w-auto">
                Staff sign in <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/ekirs/apply" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15 sm:w-auto">
                Start EKIRS application
              </Link>
              <Link href="/verify" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 sm:w-auto">
                Business verification
              </Link>
            </div>
          </div>
          <div className="min-w-0 rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl shadow-emerald-950/40 backdrop-blur">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Configured businesses", metrics.totalBusinesses],
                ["Constitutional LGAs", EKIRS_JURISDICTION.geography.constitutionalLgas.length],
                ["Verification levels", EKIRS_JURISDICTION.verificationLevels.length],
                ["Live revenue feeds", "0"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-100">{label}</p>
                  <p className="mt-3 text-3xl font-black">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-2xl border border-lime-200/20 bg-lime-200/10 p-4 text-sm leading-6 text-lime-50">
              Sprint 0 uses deterministic synthetic records for demonstration and UAT readiness. It does not contain taxpayer liabilities, assessments, payments or collections.
            </p>
          </div>
        </div>
      </section>

      <section id="demonstration" className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article key={pillar.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <Icon className="h-6 w-6 text-emerald-700" />
                <h2 className="mt-4 text-lg font-black">{pillar.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="pilot-onboarding" className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Controlled pilot foundation</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Built for EKIRS confirmation before live operations.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                The framework is ready for UAT account configuration, authoritative LCDA confirmation, operating procedure approval and integration planning. No live taxpayer data is required for Sprint 0.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {EKIRS_JURISDICTION.readiness.map((item) => (
                <div key={item.area} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  <h3 className="mt-3 font-black">{item.area}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <StateRevenueDisclosure text={EKIRS_JURISDICTION.demonstration.disclosure} />
          </div>
        </div>
      </section>
    </main>
  );
}
