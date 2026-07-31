import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, FileText, MapPin, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { WorkspaceContentGrid, WorkspaceSection } from "@/components/workspace/workspace-page";
import type { EkirsBusiness } from "@/lib/state-revenue/ekirs-demo-data";
import type { StateRevenueIntegration, StateRevenueJurisdictionConfig } from "@/lib/state-revenue/jurisdictions";

export const controlledDisclosure = "Controlled UAT environment — reference figures are synthetic unless explicitly labelled operational.";

export function StateRevenuePublicShell({
  config,
  children,
}: {
  config: StateRevenueJurisdictionConfig;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f5ef] text-slate-950">
      <a href="#state-revenue-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-black focus:text-slate-950 focus:shadow-xl">
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08251f]/95 text-white shadow-lg shadow-emerald-950/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <Link href="/ekirs" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-lime-200/30 bg-lime-300 text-sm font-black text-emerald-950">EK</span>
            <span>
              <span className="block text-sm font-black leading-tight">{config.name}</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-lime-100">Powered by DBIN</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-50 sm:text-sm">
            <Link href="/ekirs/apply" className="rounded-full px-3 py-2 transition hover:bg-white/10">Apply</Link>
            <Link href="/ekirs/apply/status" className="rounded-full px-3 py-2 transition hover:bg-white/10">Track application</Link>
            <Link href="/verify" className="rounded-full px-3 py-2 transition hover:bg-white/10">Verify</Link>
            <Link href="/login?workspace=ekirs" className="rounded-full bg-lime-300 px-4 py-2 font-black text-emerald-950 transition hover:bg-lime-200">Staff sign in</Link>
          </nav>
        </div>
      </header>
      <div id="state-revenue-content">{children}</div>
      <footer className="border-t border-emerald-900/10 bg-[#09251f] px-5 py-8 text-emerald-50 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-black">{config.name}</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-emerald-100/80">{controlledDisclosure}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <Link href="/ekirs/apply/status" className="rounded-full border border-white/10 px-3 py-2 hover:bg-white/10">Track application</Link>
            <Link href="/login?workspace=ekirs" className="rounded-full border border-white/10 px-3 py-2 hover:bg-white/10">Staff access</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function StateRevenueHero({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[#08251f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(190,242,100,0.24),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(16,185,129,0.18),transparent_28%),linear-gradient(135deg,#08251f,#071923_64%,#0f2f29)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#f7f5ef] to-transparent" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">{eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-emerald-50 sm:text-lg">{description}</p>
          {(primaryAction || secondaryAction) ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {primaryAction}
              {secondaryAction}
            </div>
          ) : null}
        </div>
        {children ? <div className="min-w-0">{children}</div> : null}
      </div>
    </section>
  );
}

export function StateRevenueSectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p> : null}
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{description}</p> : null}
    </div>
  );
}

export function StateRevenueDisclosure({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50/90 p-5 text-sm leading-6 text-amber-950">
      <p className="font-black">Controlled UAT disclosure</p>
      <p className="mt-1">{text}</p>
    </div>
  );
}

export function StateRevenueMetricCard({ label, value, note, classification = "Reference" }: { label: string; value: string | number; note?: string; classification?: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-200">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{label}</p>
        <span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-stone-600">{classification}</span>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-[#0c1733]">{value}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-slate-600">{note}</p> : null}
    </article>
  );
}

export function StateRevenueInsightCard({
  icon: Icon,
  title,
  description,
  action,
  tone = "emerald",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "emerald" | "amber" | "slate" | "sky";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    sky: "bg-sky-50 text-sky-800 ring-sky-200",
  }[tone];
  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/80">
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ring-1 ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </article>
  );
}

export function StateRevenueProgressTracker({ steps }: { steps: Array<{ label: string; description?: string; status?: "complete" | "current" | "next" }> }) {
  return (
    <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {steps.map((step, index) => (
        <li key={step.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className={["grid h-9 w-9 place-items-center rounded-2xl text-sm font-black", step.status === "complete" ? "bg-emerald-700 text-white" : step.status === "current" ? "bg-lime-300 text-emerald-950" : "bg-stone-100 text-stone-700"].join(" ")}>
              {index + 1}
            </span>
            <h3 className="font-black text-slate-950">{step.label}</h3>
          </div>
          {step.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function StatusBadge({ children, tone = "emerald" }: { children: ReactNode; tone?: "emerald" | "amber" | "slate" | "sky" | "rose" }) {
  const className = {
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    sky: "bg-sky-50 text-sky-800 ring-sky-200",
    rose: "bg-rose-50 text-rose-800 ring-rose-200",
  }[tone];
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${className}`}>{children}</span>;
}

export function VerificationLevelBadge({ level }: { level: EkirsBusiness["verificationLevel"] }) {
  const tone = level >= 3 ? "emerald" : level >= 2 ? "sky" : level >= 1 ? "amber" : "slate";
  return <StatusBadge tone={tone}>Level {level}</StatusBadge>;
}

export function StateRevenueBusinessTable({
  businesses,
  getProfileHref,
}: {
  businesses: EkirsBusiness[];
  getProfileHref: (business: EkirsBusiness) => string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-5 py-4">Business</th>
              <th className="px-5 py-4">LGA</th>
              <th className="px-5 py-4">Sector</th>
              <th className="px-5 py-4">Verification</th>
              <th className="px-5 py-4">TIN</th>
              <th className="px-5 py-4">Readiness</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {businesses.map((business) => (
              <tr key={business.id} className="align-top transition hover:bg-emerald-50/30">
                <td className="px-5 py-4">
                  <p className="font-black text-slate-950">{business.businessName}</p>
                  <p className="mt-1 text-xs text-slate-500">{business.bin}</p>
                </td>
                <td className="px-5 py-4 text-slate-700">{business.lga}</td>
                <td className="px-5 py-4 text-slate-700">{business.sector}</td>
                <td className="px-5 py-4"><VerificationLevelBadge level={business.verificationLevel} /></td>
                <td className="px-5 py-4"><StatusBadge tone={business.tinLinkageStatus === "linked" ? "emerald" : business.tinLinkageStatus === "pending" ? "amber" : "slate"}>{business.tinLinkageStatus.replace("_", " ")}</StatusBadge></td>
                <td className="px-5 py-4 text-xs leading-5 text-slate-600">{business.supportNeeds.slice(0, 2).join(", ")}</td>
                <td className="px-5 py-4">
                  <Link href={getProfileHref(business)} className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-950">
                    Open profile <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const EkirsBusinessTable = StateRevenueBusinessTable;

export function FormalisationJourney({ config }: { config: StateRevenueJurisdictionConfig }) {
  return (
    <WorkspaceContentGrid>
      {config.verificationLevels.map((level) => (
        <article key={level.level} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-sm font-black text-emerald-800 ring-1 ring-emerald-200">{level.level}</span>
            <h3 className="font-black text-slate-950">{level.label}</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{level.description}</p>
        </article>
      ))}
    </WorkspaceContentGrid>
  );
}

export function IntegrationCatalogue({ integrations }: { integrations: StateRevenueIntegration[] }) {
  return (
    <WorkspaceContentGrid>
      {integrations.map((integration) => (
        <article key={integration.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{integration.category}</p>
              <h3 className="mt-2 font-black text-slate-950">{integration.name}</h3>
            </div>
            <StatusBadge tone={integration.status === "future" ? "amber" : "emerald"}>{integration.status === "future" ? "Institutional/API approval required" : integration.status.replace("_", " ")}</StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{integration.description}</p>
          <p className="mt-3 text-xs font-bold text-slate-500">Data exchange: {integration.liveData ? "Available internally" : "Subject to institutional approval"}</p>
        </article>
      ))}
    </WorkspaceContentGrid>
  );
}

export function EligibilityPolicyPanel({ config }: { config: StateRevenueJurisdictionConfig }) {
  return (
    <WorkspaceSection title="Eligibility policy model" description="The decision model supports governed business formalisation without turning on live taxpayer assessment workflows.">
      <div className="grid gap-4 md:grid-cols-2">
        {config.eligibilitySignals.map((signal) => (
          <article key={signal.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <h3 className="font-black text-slate-950">{signal.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{signal.description}</p>
                <p className="mt-2 text-xs font-bold text-slate-500">Evidence: {signal.evidence.join(", ")}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </WorkspaceSection>
  );
}

export function GeographyFoundation({ config }: { config: StateRevenueJurisdictionConfig }) {
  return (
    <WorkspaceSection title={`${config.geography.state} geography model`} description="The framework separates constitutional LGAs from LCDA records pending authoritative confirmation.">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-700" />
            <h3 className="font-black text-slate-950">16 constitutional LGAs</h3>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {config.geography.constitutionalLgas.map((lga) => <StatusBadge key={lga} tone="slate">{lga}</StatusBadge>)}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h3 className="font-black">LCDA support pending</h3>
          </div>
          <p className="mt-3 text-sm leading-6">{config.geography.lcdaStatus.note}</p>
          <p className="mt-3 text-xs font-black">Expected LCDA count pending confirmation: {config.geography.lcdaStatus.configuredCount}</p>
        </div>
      </div>
    </WorkspaceSection>
  );
}

export function PilotReadinessList({ config }: { config: StateRevenueJurisdictionConfig }) {
  return (
    <WorkspaceContentGrid>
      {config.readiness.map((item) => (
        <article key={item.area} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            {item.status === "ready" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /> : <Sparkles className="mt-0.5 h-5 w-5 text-amber-600" />}
            <div>
              <h3 className="font-black text-slate-950">{item.area}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.note}</p>
              <div className="mt-3"><StatusBadge tone={item.status === "ready" ? "emerald" : item.status === "requires_confirmation" ? "amber" : "sky"}>{item.status.replaceAll("_", " ")}</StatusBadge></div>
            </div>
          </div>
        </article>
      ))}
    </WorkspaceContentGrid>
  );
}
