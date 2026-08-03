import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Factory,
  Flag,
  Landmark,
  Network,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LCDBO_PARTNER_HREF, LCDBO_REGISTER_HREF, lcdboPublicHref } from "@/lib/lcdbo/content";
import {
  lcdboAuthoritativeMeasures,
  lcdboAuthoritativeSourceSummary,
  lcdboImplementationPhases,
  lcdboInstitutionalFramework,
  lcdboInvestmentPipelines,
  lcdboInvestmentSources,
  lcdboKpiFramework,
  lcdboMilestoneProgrammes,
  lcdboProgrammePillars,
} from "@/lib/lcdbo/programme-model";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export const metadata: Metadata = {
  title: "LCDBO Programme Model and Milestones | National Industrial Transformation Pathway",
  description:
    "Explore the LCDBO authoritative programme model, national ambition, milestone programmes, investment architecture, implementation phases and KPI framework.",
  alternates: {
    canonical: `${LCDBO_CANONICAL_ORIGIN}/programme-and-milestones`,
  },
};

export default function LcdboProgrammeAndMilestonesPage() {
  return (
    <LcdboShell>
      <section className="relative overflow-hidden bg-[#06172f] px-4 py-20 text-white sm:px-6 lg:py-24">
        <div className="absolute -right-32 top-12 h-96 w-96 rounded-full bg-[#008751]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-[#D4A017]/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl">
          <p className="inline-flex rounded-full border border-[#efc85d]/35 bg-[#efc85d]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">
            Authoritative programme model
          </p>
          <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[1.02] tracking-[-0.045em] sm:text-7xl">
            The LCDBO national pathway from raw materials to industrial competitiveness.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">
            A public summary of the source-backed programme ambition, pillar framework, implementation milestones, investment model and KPI architecture for Local Content Development Beyond Oil.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={LCDBO_REGISTER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">
              Register Your Business <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={LCDBO_PARTNER_HREF} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">
              Partner With LCDBO
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Governed ambition"
            title="Programme figures with clear classification."
            description={lcdboAuthoritativeSourceSummary.governanceDisclosure}
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {lcdboAuthoritativeMeasures.map((measure) => (
              <article key={measure.key} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#008751]/30 hover:bg-white hover:shadow-lg">
                <p className="text-4xl font-black tracking-tight text-[#06172f]">{measure.value}</p>
                <h2 className="mt-2 text-base font-black text-[#06172f]">{measure.label}</h2>
                <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#008751]">{measure.classification}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{measure.timeframe}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{measure.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f3f6f9] px-4 py-14 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Programme pillars"
            title="Ten delivery pillars for industrial transformation."
            description="The model combines industrial infrastructure, enterprise formalisation, research commercialisation, finance, skills, market access, resilience and digital programme intelligence."
          />
          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {lcdboProgrammePillars.map((pillar, index) => (
              <article key={pillar.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#D4A017]/40 hover:shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#008751]">Pillar {String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-3 text-lg font-black leading-6 text-[#06172f]">{pillar.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            dark
            eyebrow="Milestone programmes"
            title="Seven connected national programme tracks."
            description="The LCDBO milestone architecture links productive-sector development with security, infrastructure, transport, social infrastructure, power and broadband enablement."
          />
          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {lcdboMilestoneProgrammes.map((programme) => (
              <article key={programme.abbreviation} className="rounded-2xl border border-white/10 bg-white/[0.055] p-5 transition hover:-translate-y-1 hover:border-[#efc85d]/40 hover:bg-white/[0.08]">
                <p className="text-3xl font-black text-[#efc85d]">{programme.abbreviation}</p>
                <h2 className="mt-4 text-base font-black leading-6 text-white">{programme.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{programme.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Implementation framework"
            title="A four-phase pathway from setup to global competitiveness."
            description="The source model describes phased implementation across institutional setup, infrastructure development, commercial scale-up and global competitiveness."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {lcdboImplementationPhases.map((phase) => (
              <article key={phase.phase} className="flex flex-col rounded-[26px] border border-slate-200 bg-[#f8fafc] p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <Flag className="h-6 w-6 text-[#008751]" />
                  <span className="rounded-full bg-[#D4A017]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#6d4c06]">{phase.timeframe}</span>
                </div>
                <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-[#008751]">{phase.phase}</p>
                <h2 className="mt-2 text-xl font-black text-[#06172f]">{phase.title}</h2>
                <p className="mt-3 text-sm font-bold text-slate-500">{phase.geography}</p>
                <ul className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
                  {phase.focus.map((item) => (
                    <li key={item} className="flex gap-2"><BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#008751]" />{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f3f6f9] px-4 py-14 sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <SectionHeading
              eyebrow="Investment architecture"
              title="A $100B mobilisation ambition requires many forms of capital."
              description="The model describes investment mobilisation across public equity, private capital, development finance, guarantees, infrastructure, raw-material assets and market-linked financing."
            />
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              <strong>Disclosure:</strong> investment figures describe source-backed mobilisation ambition and pipeline architecture. They are not represented as funds already raised or committed.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard title="Investment pipelines" icon={<Network className="h-5 w-5" />} items={lcdboInvestmentPipelines} />
            <ListCard title="Sources of investment" icon={<Banknote className="h-5 w-5" />} items={lcdboInvestmentSources} />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Institutional framework"
            title="Minimum-government-equity proposition with multi-stakeholder delivery."
            description="The source model positions government participation, state/LGA assets, private-sector investment, financial institutions, development partners, research institutions and host communities as part of the delivery framework."
          />
          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {lcdboInstitutionalFramework.map((actor) => (
              <article key={actor.actor} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
                <Landmark className="h-5 w-5 text-[#008751]" />
                <h2 className="mt-4 text-lg font-black text-[#06172f]">{actor.actor}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{actor.contribution}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#06172f] px-4 py-16 text-white sm:px-6 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            dark
            eyebrow="KPI governance"
            title="A target framework for governed reporting."
            description="The KPI framework is presented as source-backed target architecture. Production launch reporting should validate methodology, ownership and data lineage before any result claim is made."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {lcdboKpiFramework.map((kpi) => (
              <article key={kpi.indicator} className="rounded-2xl border border-white/10 bg-white/[0.055] p-5">
                <p className="text-2xl font-black text-[#efc85d]">{kpi.target}</p>
                <h2 className="mt-3 text-sm font-black leading-5 text-white">{kpi.indicator}</h2>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">{kpi.classification}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[30px] border border-slate-200 bg-[#f8fafc] p-6 shadow-xl shadow-slate-200/70 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#008751]">Continue the journey</p>
            <h2 className="mt-2 text-3xl font-black text-[#06172f]">Move from the programme model into participation pathways.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Explore clusters, join as an MSME, or engage as an institution, investor or technical partner.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={lcdboPublicHref("/clusters")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0B2E59] px-5 text-sm font-black text-white">
              Explore Clusters <Factory className="h-4 w-4" />
            </Link>
            <Link href={lcdboPublicHref("/opportunities")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-[#0B2E59]">
              View Opportunities <TrendingUp className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </LcdboShell>
  );
}

function ListCard({ title, icon, items }: { title: string; icon: ReactNode; items: readonly string[] }) {
  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#008751] text-white">{icon}</span>
        <h2 className="text-xl font-black text-[#06172f]">{title}</h2>
      </div>
      <ul className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#008751]" />{item}</li>
        ))}
      </ul>
    </article>
  );
}

function SectionHeading({ eyebrow, title, description, dark = false }: { eyebrow: string; title: string; description: string; dark?: boolean }) {
  return (
    <div className="max-w-3xl">
      <p className={`text-xs font-black uppercase tracking-[0.18em] ${dark ? "text-[#efc85d]" : "text-[#008751]"}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-4xl font-black tracking-tight sm:text-5xl ${dark ? "text-white" : "text-[#06172f]"}`}>{title}</h2>
      <p className={`mt-4 text-base leading-7 sm:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>{description}</p>
    </div>
  );
}
