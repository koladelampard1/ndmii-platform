import Link from "next/link";
import { AlertTriangle, ClipboardCheck, FileText, Target } from "lucide-react";
import { ImpactPageHeader, SectionCard } from "../_components";

const READINESS_ITEMS = [
  "Indicator definitions for each programme or intervention",
  "Baseline values captured before support is delivered",
  "Target values and measurement cadence",
  "Follow-up values from assessments, field monitoring, or verified evidence",
  "Report-ready calculations that avoid invented impact claims",
];

export default function ImpactIndicatorsPage() {
  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Lifecycle readiness"
        title="Impact Indicators"
        description="This module is intentionally marked as not operational. Indicator baselines, targets, and follow-up values must be implemented before the platform can produce measurable impact reports."
        badge="Missing"
        actions={[
          { href: "/dashboard/impact-intelligence/assessments", label: "Assessments", icon: ClipboardCheck },
          { href: "/dashboard/impact-intelligence/reports", label: "Reports", icon: FileText },
        ]}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-semibold">Not yet operational</h2>
            <p className="mt-2 text-sm leading-6">
              Impact Intelligence can currently track programmes, interventions, assessments, monitoring visits, evidence metadata, and report records. It cannot yet define or measure outcome indicators.
            </p>
          </div>
        </div>
      </div>

      <SectionCard title="What this module must support before activation">
        <div className="grid gap-3 md:grid-cols-2">
          {READINESS_ITEMS.map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-slate-200">
                  <Target className="h-4 w-4" />
                </span>
                <p className="text-sm leading-5 text-slate-700">{item}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Lifecycle position">
        <div className="flex flex-col gap-3 text-sm leading-6 text-slate-600 lg:flex-row lg:items-center">
          <Link href="/dashboard/impact-intelligence/evidence" className="font-medium text-emerald-700 hover:text-emerald-800">Evidence</Link>
          <span className="hidden text-slate-400 lg:inline">-&gt;</span>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-900">Impact Indicators: missing</span>
          <span className="hidden text-slate-400 lg:inline">-&gt;</span>
          <Link href="/dashboard/impact-intelligence/reports" className="font-medium text-emerald-700 hover:text-emerald-800">Reports</Link>
        </div>
      </SectionCard>
    </section>
  );
}
