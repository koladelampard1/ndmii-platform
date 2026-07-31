import Link from "next/link";
import { ArrowRight, Building2, FileSearch, ListChecks, LockKeyhole, ShieldCheck } from "lucide-react";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";
import { StateRevenueDisclosure, StateRevenueInsightCard, StateRevenueProgressTracker, StateRevenuePublicShell, StateRevenueSectionHeader, controlledDisclosure } from "@/components/state-revenue/state-revenue-components";

export const metadata = {
  title: "Apply for EKIRS Business Onboarding | DBIN",
  description: "Begin EKIRS business onboarding, eligibility verification and DBIN identity linkage.",
};

const journey = [
  { label: "Start", description: "Choose the pathway that matches your business identity status.", status: "current" as const },
  { label: "Provide details", description: "Add business, contact and Ekiti operating-location information.", status: "next" as const },
  { label: "Submit evidence", description: "Select evidence types and upload files if requested during review.", status: "next" as const },
  { label: "Track review", description: "Use your application reference to follow progress or respond to requests.", status: "next" as const },
];

const options = [
  {
    title: "I am registering a new business",
    description: "Choose this if your business does not yet have a DBIN identity.",
    need: "Business name, contact information, Ekiti operating location and supporting evidence types.",
    next: "Your application enters eligibility review before any DBIN identity is activated.",
    href: "/ekirs/apply/new",
    icon: Building2,
  },
  {
    title: "My business already has a DBIN",
    description: "Choose this if your existing DBIN business operates in Ekiti and should be linked to EKIRS onboarding.",
    need: "Sign in with the account that owns the business. Only your own businesses will appear.",
    next: "The existing BIN is preserved while EKIRS reviews the Ekiti operating relationship.",
    href: "/ekirs/apply/existing",
    icon: ShieldCheck,
  },
  {
    title: "Track or resume an application",
    description: "Use your application reference to view status, resume a draft or respond to an information request.",
    need: "Application reference and the email used on the application.",
    next: "Editable applications can be resumed; submitted applications remain read-only unless EKIRS requests action.",
    href: "/ekirs/apply/status",
    icon: FileSearch,
  },
];

export default function EkirsApplyPage() {
  return (
    <StateRevenuePublicShell config={EKIRS_JURISDICTION}>
      <section className="bg-[#08251f] px-5 py-14 text-white lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">Business onboarding</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">Choose the right EKIRS application pathway.</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-emerald-50">
            Start with a simple guided choice. The service will protect private evidence, preserve existing DBIN identities and keep each application tied to an Ekiti operating presence.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <StateRevenueProgressTracker steps={journey} />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {options.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/80">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
                  <Icon className="h-6 w-6" />
                </span>
                <h2 className="mt-5 text-xl font-black text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                <div className="mt-5 space-y-3 rounded-2xl bg-stone-50 p-4 text-xs leading-5 text-slate-600">
                  <p><span className="font-black text-slate-900">You will need:</span> {item.need}</p>
                  <p><span className="font-black text-slate-900">What happens next:</span> {item.next}</p>
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-700 group-hover:text-emerald-950">
                  Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="bg-white/70 px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <StateRevenueSectionHeader
            eyebrow="Before you begin"
            title="Built for clarity, privacy and controlled review."
            description="EKIRS applications are reviewed by authorised institution users. The platform does not expose private evidence publicly and does not calculate tax liability or payment obligations."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <StateRevenueInsightCard icon={ListChecks} title="Clear review journey" description="Each application receives a reference and follows a visible lifecycle from draft to review and decision." />
            <StateRevenueInsightCard icon={LockKeyhole} title="Private evidence" description="Evidence metadata and files are available only to authorised users and applicant-owned flows." tone="sky" />
            <StateRevenueInsightCard icon={ShieldCheck} title="Ekiti operating presence" description="The application records location context so EKIRS can review genuine operating presence." tone="amber" />
          </div>
          <div className="mt-8">
            <StateRevenueDisclosure text={controlledDisclosure} />
          </div>
        </div>
      </section>
    </StateRevenuePublicShell>
  );
}
