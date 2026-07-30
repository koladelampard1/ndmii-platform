import Link from "next/link";
import { ArrowRight, Building2, FileSearch, ShieldCheck } from "lucide-react";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";

export const metadata = {
  title: "Apply for EKIRS Business Onboarding | DBIN",
  description: "Begin EKIRS business onboarding, eligibility verification and DBIN identity linkage.",
};

export default function EkirsApplyPage() {
  return (
    <main className="min-h-screen bg-[#f6faf7] text-slate-950">
      <section className="bg-[#0b2d26] px-6 py-16 text-white lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">EKIRS × DBIN Sprint 1</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">Business onboarding, eligibility verification and digital identity linkage.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-emerald-50">
            Apply for controlled EKIRS participation by confirming a genuine Ekiti operating presence. Existing DBIN businesses keep their canonical identity; new eligible businesses enter the governed identity workflow.
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-6 py-12 lg:grid-cols-3 lg:px-8">
        {[
          {
            title: "New business",
            description: "Start an EKIRS application for a business that does not yet have a DBIN identity.",
            href: "/ekirs/apply/new",
            icon: Building2,
          },
          {
            title: "Existing DBIN business",
            description: "Apply for Ekiti jurisdiction participation without creating a duplicate business identity.",
            href: "/ekirs/apply/existing",
            icon: ShieldCheck,
          },
          {
            title: "Track application",
            description: "Check status using your application reference and contact email.",
            href: "/ekirs/apply/status",
            icon: FileSearch,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
              <Icon className="h-7 w-7 text-emerald-700" />
              <h2 className="mt-5 text-xl font-black">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-700">Continue <ArrowRight className="h-4 w-4" /></span>
            </Link>
          );
        })}
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-14 lg:px-8">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <p className="font-black">Controlled UAT boundary</p>
          <p className="mt-1">{EKIRS_JURISDICTION.demonstration.disclosure} Sprint 1 application records are marked as UAT/test records until live activation is approved.</p>
        </div>
      </section>
    </main>
  );
}
