import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  FileCheck2,
  Handshake,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Amaanah MSME Growth Platform | Powered by DBIN",
  description:
    "A governed enterprise-development and non-interest financing platform for Amaanah Finance Company, its officers, partners and MSMEs.",
};

const journey = [
  ["01", "Identify", "Bring eligible MSMEs into a governed institutional pipeline."],
  ["02", "Diagnose", "Assess enterprise needs, evidence and financing readiness."],
  ["03", "Develop", "Coordinate structured advisory and improvement plans."],
  ["04", "Finance", "Prepare complete cases for Amaanah's independent decision process."],
  ["05", "Support", "Monitor progress, interventions, risks and market connections."],
] as const;

const capabilities = [
  {
    title: "One enterprise record",
    copy: "A continuous digital business profile that carries verified information, documents and development history forward.",
    icon: BadgeCheck,
  },
  {
    title: "Coordinated field delivery",
    copy: "Clear assignments, service standards and evidence for internal officers and authorised external business-support agents.",
    icon: UsersRound,
  },
  {
    title: "Financing-ready cases",
    copy: "Product-specific requirements, structured evidence and decision handovers without replacing Amaanah's approvals.",
    icon: FileCheck2,
  },
  {
    title: "Portfolio intelligence",
    copy: "Management visibility across the MSME journey, delivery performance, post-finance actions and emerging risks.",
    icon: BarChart3,
  },
] as const;

export default function AmaanahPortalPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ec] text-[#082f2b]">
      <section className="relative isolate overflow-hidden bg-[#033531] text-white">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_85%_15%,rgba(214,166,46,0.20),transparent_34%),linear-gradient(135deg,#022d2a_0%,#06483d_58%,#033531_100%)]" />
        <div className="absolute -bottom-40 -left-16 -z-10 h-96 w-96 rounded-full border border-white/10 bg-emerald-300/5 blur-3xl" />

        <div className="mx-auto max-w-7xl px-6 pb-20 pt-6 sm:px-8 lg:px-10 lg:pb-28">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-lg shadow-emerald-950/20">
              <Image
                src="/brands/amaanah-finance-logo.svg"
                alt="Amaanah Finance Company"
                width={230}
                height={60}
                priority
                className="h-10 w-auto sm:h-12"
              />
            </div>
            <div className="flex items-center gap-4">
              <p className="hidden text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/70 sm:block">
                Powered by DBIN
              </p>
              <Link
                href="/login?workspace=amaanah&next=/dashboard/amaanah"
                className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"
              >
                Sign in
              </Link>
            </div>
          </header>

          <div className="grid gap-12 pt-16 lg:grid-cols-[1.12fr_0.88fr] lg:items-end lg:pt-24">
            <div>
              <p className="inline-flex rounded-full border border-[#d6a62e]/40 bg-[#d6a62e]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#f0d58b]">
                MSME development and non-interest finance
              </p>
              <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[1.03] tracking-tight sm:text-6xl lg:text-7xl">
                From enterprise potential
                <span className="block text-[#e0bc5c]">to responsible growth.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-emerald-50/80 sm:text-lg">
                A unified operating platform for identifying, developing, preparing and supporting MSMEs across Amaanah&apos;s enterprise-finance journey.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login?workspace=amaanah&next=/dashboard/amaanah"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#d6a62e] px-5 py-3 text-sm font-black text-[#033531] transition hover:bg-[#e4c469]"
                >
                  Open secure workspace <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#journey" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                  See the enterprise journey
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl shadow-emerald-950/40 backdrop-blur-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e0bc5c]">Governed delivery</p>
                  <h2 className="mt-2 text-2xl font-black">One accountable MSME journey</h2>
                </div>
                <ShieldCheck className="h-10 w-10 text-[#e0bc5c]" />
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {["Institution leadership", "Internal officers", "External partners", "Participating MSMEs"].map((label) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-sm font-bold text-white">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-100/65">Role-scoped access, recorded actions and measurable outcomes.</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="journey" className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6818]">Continuous enterprise development</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A clear operating path from mobilisation to sustainable growth</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Each stage creates the evidence, accountability and management visibility required for the next—while Amaanah retains its independent financing and compliance decisions.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {journey.map(([number, title, copy]) => (
            <article key={title} className="relative overflow-hidden rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
              <p className="text-3xl font-black text-[#d6a62e]/35">{number}</p>
              <h3 className="mt-5 text-lg font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-white/70">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6818]">Institutional capability</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Built around how enterprise finance is delivered</h2>
              <p className="mt-4 leading-7 text-slate-600">
                The platform connects field execution, financing preparation, governance and management intelligence without fragmenting the enterprise record.
              </p>
              <div className="mt-7 flex items-center gap-3 rounded-2xl bg-[#033531] p-5 text-white">
                <Handshake className="h-8 w-8 shrink-0 text-[#e0bc5c]" />
                <p className="text-sm leading-6 text-emerald-50/80">Designed for collaboration between Amaanah teams, approved partners and MSMEs.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {capabilities.map((capability) => (
                <article key={capability.title} className="rounded-3xl border border-emerald-950/10 bg-[#faf8f2] p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#033531] text-[#e0bc5c]">
                    <capability.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-6 text-lg font-black">{capability.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{capability.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-6 rounded-[2rem] bg-[#033531] p-7 text-white shadow-xl sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <BriefcaseBusiness className="h-7 w-7 text-[#e0bc5c]" />
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e0bc5c]">Authorised institutional access</p>
            </div>
            <h2 className="mt-4 text-2xl font-black sm:text-3xl">Open the Amaanah enterprise-growth workspace</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/75">
              Access is limited by institutional membership and role. Every administrative, advisory and financing workflow remains permission-bound and auditable.
            </p>
          </div>
          <Link
            href="/login?workspace=amaanah&next=/dashboard/amaanah"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d6a62e] px-5 py-3 text-sm font-black text-[#033531]"
          >
            Continue to sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-emerald-950/10 bg-[#ece7da]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-7 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p className="font-semibold text-[#033531]">Amaanah MSME Growth Platform</p>
          <p>Powered by Digital Business Identity Network</p>
        </div>
      </footer>
    </main>
  );
}
