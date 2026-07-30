import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, FileText, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { WorkspaceContentGrid, WorkspaceSection } from "@/components/workspace/workspace-page";
import type { EkirsBusiness } from "@/lib/state-revenue/ekirs-demo-data";
import type { StateRevenueIntegration, StateRevenueJurisdictionConfig } from "@/lib/state-revenue/jurisdictions";

export function StateRevenueDisclosure({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
      <p className="font-black">Sprint 0 disclosure</p>
      <p className="mt-1">{text}</p>
    </div>
  );
}

export function StateRevenueMetricCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-[#0c1733]">{value}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-slate-600">{note}</p> : null}
    </article>
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
            <StatusBadge tone={integration.status === "future" ? "amber" : "emerald"}>{integration.status.replace("_", " ")}</StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{integration.description}</p>
          <p className="mt-3 text-xs font-bold text-slate-500">Live data: {integration.liveData ? "enabled" : "not enabled"}</p>
        </article>
      ))}
    </WorkspaceContentGrid>
  );
}

export function EligibilityPolicyPanel({ config }: { config: StateRevenueJurisdictionConfig }) {
  return (
    <WorkspaceSection title="Eligibility policy foundation" description="Sprint 0 defines the decision model without turning on live taxpayer workflows.">
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
    <WorkspaceSection title={`${config.geography.state} geography foundation`} description="The framework separates constitutional LGAs from LCDA records pending authoritative confirmation.">
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
          <p className="mt-3 text-xs font-black">Configured expected LCDA count: {config.geography.lcdaStatus.configuredCount}</p>
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
