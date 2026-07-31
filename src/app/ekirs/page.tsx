import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpenCheck, Building2, DatabaseZap, FileSearch, LockKeyhole, MapPinned, ReceiptText, ShieldCheck, Store, UsersRound } from "lucide-react";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";
import { getEkirsMetrics } from "@/lib/state-revenue/ekirs-demo-data";
import {
  StateRevenueHero,
  StateRevenueInsightCard,
  StateRevenueMetricCard,
  StateRevenueProgressTracker,
  StateRevenuePublicShell,
  StateRevenueSectionHeader,
  controlledDisclosure,
} from "@/components/state-revenue/state-revenue-components";

const staffLoginHref = "/login?workspace=ekirs";

export const metadata: Metadata = {
  title: "Ekiti Business Formalisation and Revenue Readiness Platform | DBIN",
  description: "A trusted digital pathway helping businesses establish their identity, strengthen their records and participate more confidently in Ekiti’s formal economy.",
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

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-emerald-950 shadow-lg shadow-lime-950/20 transition hover:-translate-y-0.5 hover:bg-lime-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-100 sm:w-auto">
      {children} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-100 sm:w-auto">
      {children}
    </Link>
  );
}

export default function EkirsLandingPage() {
  const metrics = getEkirsMetrics();

  return (
    <StateRevenuePublicShell config={EKIRS_JURISDICTION}>
      <StateRevenueHero
        eyebrow="EKIRS × DBIN digital service"
        title="Ekiti Business Formalisation and Revenue Readiness Platform"
        description="A trusted digital pathway helping businesses establish their identity, strengthen their records and participate more confidently in Ekiti’s formal economy."
        primaryAction={<PrimaryLink href="/ekirs/apply">Register or formalise a business</PrimaryLink>}
        secondaryAction={<SecondaryLink href={staffLoginHref}>Staff sign in</SecondaryLink>}
      >
        <div className="rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl shadow-emerald-950/40 backdrop-blur-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <StateRevenueMetricCard label="Demonstration business records" value={metrics.totalBusinesses} note="Synthetic records for controlled presentation." classification="Synthetic" />
            <StateRevenueMetricCard label="Constitutional LGAs" value={EKIRS_JURISDICTION.geography.constitutionalLgas.length} note="Configured Ekiti coverage model." classification="Reference" />
            <StateRevenueMetricCard label="Verification levels" value={EKIRS_JURISDICTION.verificationLevels.length} note="Governed identity-readiness pathway." classification="Policy" />
            <StateRevenueMetricCard label="Revenue integrations" value="EKIRS approval" note="No live liability or collection feed is active." classification="Not activated" />
          </div>
          <div className="mt-5 rounded-2xl border border-lime-200/20 bg-lime-200/10 p-4 text-sm leading-6 text-lime-50">
            {controlledDisclosure}
          </div>
        </div>
      </StateRevenueHero>

      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <StateRevenueSectionHeader
          eyebrow="For businesses"
          title="A clearer path into Ekiti’s formal economy."
          description="The service helps business owners organise core records, connect an operating location, and move through a governed review journey without exposing private evidence publicly."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StateRevenueInsightCard icon={BadgeCheck} title="Trusted digital business identity" description="Eligible businesses can move toward a canonical DBIN identity that is easier for customers, institutions and partners to verify." />
          <StateRevenueInsightCard icon={BookOpenCheck} title="Better business records" description="The pathway encourages practical records, contact details, location context and evidence that support formal participation." tone="sky" />
          <StateRevenueInsightCard icon={Store} title="Improved business visibility" description="Businesses can build readiness for programmes, procurement, finance and public verification without losing control of private data." />
          <StateRevenueInsightCard icon={UsersRound} title="Support and formalisation pathways" description="Review outcomes can identify where a business needs evidence, field verification or additional information before approval." tone="amber" />
        </div>
      </section>

      <section className="bg-white/70 px-5 py-14 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <StateRevenueSectionHeader
            eyebrow="How it works"
            title="Simple for applicants. Governed for EKIRS."
            description="Each application follows a clear route from self-declaration to institutional review, with private evidence and audit history protected inside the workspace."
          />
          <div className="mt-8">
            <StateRevenueProgressTracker
              steps={[
                { label: "Apply", description: "Choose a new-business or existing-DBIN-business pathway and provide plain-language business details.", status: "complete" },
                { label: "Verify presence", description: "Record the Ekiti operating location and provide supporting evidence where needed.", status: "current" },
                { label: "Institutional review", description: "Authorised EKIRS users review eligibility, evidence, duplicates and field-verification referrals.", status: "next" },
                { label: "Activate identity", description: "Approved businesses can progress toward DBIN identity and formalisation services.", status: "next" },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">For EKIRS</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Operational visibility without revenue surveillance.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            EKIRS gains a controlled view of business formalisation, location coverage, eligibility workload and data-quality signals. The platform does not calculate tax liability, payment obligations or collections.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/ekirs" className="rounded-full bg-emerald-800 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-900">Open institutional operations</Link>
            <Link href="/ekirs/apply/status" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">Track an application</Link>
            <Link href="/verify" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">Verify a business identity</Link>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <StateRevenueInsightCard icon={ReceiptText} title="Better business records" description="Applications create structured onboarding records, location context, evidence metadata and decision history." />
          <StateRevenueInsightCard icon={MapPinned} title="Geographic visibility" description="Synthetic and operational views separate LGA coverage from private applicant evidence." tone="sky" />
          <StateRevenueInsightCard icon={ShieldCheck} title="Governed verification" description="Role-based institutional access controls reviewer, field officer, observer and administrator experiences." />
          <StateRevenueInsightCard icon={DatabaseZap} title="Formalisation intelligence" description="Readiness views show bottlenecks, integration dependencies and data-quality exceptions without implying achieved revenue." tone="amber" />
        </div>
      </section>

      <section className="bg-[#0b2d26] px-5 py-14 text-white lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">Trust and security</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Designed around privacy, consent and institutional control.</h2>
            <p className="mt-4 text-sm leading-7 text-emerald-50">
              Evidence remains private, review actions are role-bound, and institutional decisions are supported by audit history. Controlled UAT status is clearly labelled so no synthetic figure is mistaken for live state performance.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [LockKeyhole, "Private evidence", "Uploaded evidence is protected and available only through authorised review flows."],
              [ShieldCheck, "Role-based access", "Applicants, reviewers, field officers, administrators and observers see only what their role permits."],
              [FileSearch, "Audit history", "Material review and status events are recorded for institutional accountability."],
              [Building2, "Consent-aware data use", "Location and evidence workflows are designed for controlled, lawful formalisation review."],
            ].map(([Icon, title, description]) => (
              <article key={String(title)} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <Icon className="h-5 w-5 text-lime-200" />
                <h3 className="mt-4 font-black">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-50/85">{description as string}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </StateRevenuePublicShell>
  );
}
