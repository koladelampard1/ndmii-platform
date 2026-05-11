import Link from "next/link";
import {
  ClipboardCheck,
  HandCoins,
  FileArchive,
  FileText,
  Flag,
  LineChart,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import {
  listImpactAssessments,
  listImpactFieldVisits,
  listImpactInterventions,
  listImpactProgrammes,
  listImpactReports,
} from "@/lib/data/impact-intelligence";

type ImpactSection = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const SECTIONS: ImpactSection[] = [
  {
    href: "/dashboard/impact-intelligence/programmes",
    label: "Programmes",
    description: "Register intervention programmes, sponsoring institutions, timelines, and operating status.",
    icon: Flag,
  },
  {
    href: "/dashboard/impact-intelligence/interventions",
    label: "Interventions",
    description: "Track MSME-level interventions, stage progression, disbursement status, and timeline events.",
    icon: HandCoins,
  },
  {
    href: "/dashboard/impact-intelligence/assessments",
    label: "Assessments",
    description: "Prepare MSME assessment instruments and track readiness, baseline, monitoring, and closure reviews.",
    icon: ClipboardCheck,
  },
  {
    href: "/dashboard/impact-intelligence/field-visits",
    label: "Field Visits",
    description: "Coordinate field monitoring visits, findings, recommendations, and follow-up status.",
    icon: MapPin,
  },
  {
    href: "/dashboard/impact-intelligence/evidence",
    label: "Evidence",
    description: "Organize photos, documents, field artefacts, and other files that support impact claims.",
    icon: FileArchive,
  },
  {
    href: "/dashboard/impact-intelligence/reports",
    label: "Reports",
    description: "Prepare evidence-backed programme reports for institutional review and export workflows.",
    icon: FileText,
  },
];

type ImpactIntelligencePageProps = {
  activeSection?: "overview" | "programmes" | "interventions" | "assessments" | "field-visits" | "evidence" | "reports";
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function ImpactIntelligenceContent({ activeSection = "overview" }: ImpactIntelligencePageProps) {
  const [programmes, interventions, assessments, fieldVisits, reports] = await Promise.all([
    listImpactProgrammes({ limit: 5 }),
    listImpactInterventions({ limit: 5 }),
    listImpactAssessments({ limit: 5 }),
    listImpactFieldVisits({ limit: 5 }),
    listImpactReports({ limit: 5 }),
  ]);

  const active = SECTIONS.find((section) => section.href.endsWith(activeSection));

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">BOI Impact Intelligence</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {active?.label ?? "Impact Intelligence"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {active?.description ??
                "Foundational workspace for programme intelligence, intervention monitoring, field evidence, and evidence-backed impact reporting across DBIN."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Programmes</p>
              <p className="text-xl font-semibold text-slate-950">{programmes.length}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Interventions</p>
              <p className="text-xl font-semibold text-slate-950">{interventions.length}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Assessments</p>
              <p className="text-xl font-semibold text-slate-950">{assessments.length}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Field visits</p>
              <p className="text-xl font-semibold text-slate-950">{fieldVisits.length}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Reports</p>
              <p className="text-xl font-semibold text-slate-950">{reports.length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const selected = section.href.endsWith(activeSection);
          return (
            <Link
              key={section.href}
              href={section.href}
              className={[
                "rounded-xl border bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40",
                selected ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200",
              ].join(" ")}
            >
              <Icon className="h-5 w-5 text-emerald-700" />
              <h2 className="mt-3 font-semibold text-slate-950">{section.label}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">{section.description}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-950">Recent Programmes</h2>
            <Link href="/dashboard/impact-intelligence/programmes" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
              View programmes
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {programmes.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">
                Programme records will appear here after the foundational tables are populated.
              </p>
            ) : (
              programmes.map((programme) => (
                <div key={programme.id} className="rounded-lg border p-3">
                  <p className="font-medium text-slate-950">{programme.name}</p>
                  <p className="text-xs text-slate-500">
                    {programme.programme_code ?? "No code"} • {programme.sponsor_name ?? "Sponsor pending"} • {programme.status ?? "draft"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-950">Operational Queue</h2>
            <LineChart className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium text-slate-950">Latest intervention</p>
              <p className="mt-1 text-sm text-slate-600">
                {interventions[0] ? `${interventions[0].title} • ${interventions[0].status ?? "planned"}` : "No intervention records yet."}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium text-slate-950">Latest assessment</p>
              <p className="mt-1 text-sm text-slate-600">
                {assessments[0]
                  ? `${assessments[0].assessment_type ?? "Assessment"} • ${assessments[0].status ?? "draft"} • ${formatDate(assessments[0].conducted_at)}`
                  : "No assessment records yet."}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium text-slate-950">Next field visit</p>
              <p className="mt-1 text-sm text-slate-600">
                {fieldVisits[0]
                  ? `${fieldVisits[0].status ?? "scheduled"} • ${formatDate(fieldVisits[0].visit_date)}`
                  : "No field visit records yet."}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium text-slate-950">Latest report</p>
              <p className="mt-1 text-sm text-slate-600">
                {reports[0] ? `${reports[0].title} • ${reports[0].status ?? "draft"}` : "No report records yet."}
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
