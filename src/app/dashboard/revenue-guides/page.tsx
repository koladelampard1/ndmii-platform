import Link from "next/link";
import { AlertTriangle, BadgeCheck, BookOpenCheck, CalendarClock, ClipboardList, FileWarning, ReceiptText, Target } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/data/invoicing";
import { demoDisclosure, formatNrsStatus, requireNrsWorkspace } from "@/lib/nrs/access";

type MsmeRow = {
  id: string;
  msme_id: string | null;
  business_name: string | null;
  state: string | null;
  lga: string | null;
  sector: string | null;
  verification_status: string | null;
  tin: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
};

type TaxProfileRow = {
  msme_id: string | null;
  outstanding_amount: number | string | null;
  compliance_status: string | null;
  arrears_status: string | null;
  last_reviewed_at: string | null;
};

type ComplianceProfileRow = {
  msme_id: string | null;
  overall_status: string | null;
  compliance_score: number | null;
  risk_level: string | null;
  updated_at: string | null;
};

const guideNames = [
  "Amina Revenue Guide Desk",
  "Musa Revenue Guide Desk",
  "Zainab Revenue Guide Desk",
  "Chinedu Revenue Guide Desk",
  "Bamidele Revenue Guide Desk",
  "Hauwa Revenue Guide Desk",
];

function percentage(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "No engagement yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No engagement yet";
  return date.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function RevenueGuidesPage() {
  const ctx = await getCurrentUserContext();
  requireNrsWorkspace(ctx);

  const supabase = await createServerSupabaseClient();
  const [{ data: msmes }, { data: taxProfiles }, { data: complianceProfiles }, { data: invoices }] = await Promise.all([
    supabase
      .from("msmes")
      .select("id,msme_id,business_name,state,lga,sector,verification_status,tin,contact_email,contact_phone,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("tax_profiles")
      .select("msme_id,outstanding_amount,compliance_status,arrears_status,last_reviewed_at")
      .limit(500),
    supabase
      .from("msme_compliance_profiles")
      .select("msme_id,overall_status,compliance_score,risk_level,updated_at")
      .limit(500),
    supabase
      .from("invoices")
      .select("msme_id")
      .limit(1000),
  ]);

  const taxByMsme = new Map((taxProfiles ?? []).map((row: TaxProfileRow) => [row.msme_id, row]));
  const complianceByMsme = new Map((complianceProfiles ?? []).map((row: ComplianceProfileRow) => [row.msme_id, row]));
  const invoicingMsmes = new Set((invoices ?? []).map((row) => row.msme_id).filter(Boolean));
  const groups = new Map<string, MsmeRow[]>();

  for (const msme of (msmes ?? []) as MsmeRow[]) {
    const key = `${msme.state ?? "Unassigned"}|${msme.lga ?? "Statewide"}`;
    groups.set(key, [...(groups.get(key) ?? []), msme]);
  }

  const guideRows = [...groups.entries()]
    .map(([key, assignedMsmes], index) => {
      const [state, lga] = key.split("|");
      const verified = assignedMsmes.filter((msme) => msme.verification_status === "verified").length;
      const profileComplete = assignedMsmes.filter((msme) => Boolean(msme.tin || msme.contact_email || msme.contact_phone)).length;
      const compliant = assignedMsmes.filter((msme) => {
        const tax = taxByMsme.get(msme.id);
        const compliance = complianceByMsme.get(msme.id);
        return tax?.compliance_status === "compliant" || compliance?.overall_status === "compliant" || compliance?.overall_status === "approved";
      }).length;
      const followUps = assignedMsmes.filter((msme) => {
        const tax = taxByMsme.get(msme.id);
        const compliance = complianceByMsme.get(msme.id);
        return Number(tax?.outstanding_amount ?? 0) > 0
          || ["high", "medium"].includes(String(tax?.arrears_status ?? "").toLowerCase())
          || ["high", "medium"].includes(String(compliance?.risk_level ?? "").toLowerCase())
          || msme.verification_status !== "verified";
      });
      const outstanding = assignedMsmes.reduce((sum, msme) => sum + Number(taxByMsme.get(msme.id)?.outstanding_amount ?? 0), 0);
      const lastEngagement = assignedMsmes
        .map((msme) => taxByMsme.get(msme.id)?.last_reviewed_at ?? complianceByMsme.get(msme.id)?.updated_at ?? msme.created_at)
        .filter(Boolean)
        .sort()
        .at(-1);

      return {
        id: key,
        guideName: guideNames[index % guideNames.length],
        state,
        lga,
        assignedMsmes,
        activationProgress: percentage(verified, assignedMsmes.length),
        profileCompletion: percentage(profileComplete, assignedMsmes.length),
        complianceRate: percentage(compliant, assignedMsmes.length),
        followUps,
        outstanding,
        lastEngagement,
        nextAction: followUps.length > 0 ? "Follow up businesses needing verification, TIN linkage or evidence review" : "Maintain engagement and monitor new invoice activity",
      };
    })
    .sort((a, b) => b.followUps.length - a.followUps.length || b.assignedMsmes.length - a.assignedMsmes.length)
    .slice(0, 12);
  const allMsmes = (msmes ?? []) as MsmeRow[];
  const businessesAwaitingTin = allMsmes.filter((msme) => !msme.tin).length;
  const businessesNeedingActivation = allMsmes.filter((msme) => msme.verification_status !== "verified").length;
  const businessesNeedingBookkeeping = allMsmes.filter((msme) => !taxByMsme.has(msme.id)).length;
  const businessesNotInvoicing = allMsmes.filter((msme) => !invoicingMsmes.has(msme.id)).length;
  const complianceFollowUps = guideRows.reduce((sum, guide) => sum + guide.followUps.length, 0);
  const averageActivation = percentage(guideRows.reduce((sum, guide) => sum + guide.activationProgress, 0), Math.max(1, guideRows.length * 100));
  const averageProfileCompletion = percentage(guideRows.reduce((sum, guide) => sum + guide.profileCompletion, 0), Math.max(1, guideRows.length * 100));
  const averageCompliance = percentage(guideRows.reduce((sum, guide) => sum + guide.complianceRate, 0), Math.max(1, guideRows.length * 100));
  const topGuide = guideRows.slice().sort((a, b) => b.complianceRate - a.complianceRate || b.activationProgress - a.activationProgress)[0];

  return (
    <section className="space-y-5">
      <header className="rounded-3xl border bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-5 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Nigeria Revenue Service • Powered by DBIN Infrastructure</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Revenue Guide Operations Centre</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">An executive workspace for activating businesses, closing TIN gaps, strengthening bookkeeping behaviour and guiding MSMEs toward compliance and growth readiness.</p>
          </div>
          <Link href="/dashboard/nrs" className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">Back to Intelligence Centre</Link>
        </div>
        <p className="mt-4 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-emerald-50">{demoDisclosure()} Revenue Guide assignments are derived from DBIN demo records and do not represent payroll, commission or official field-force management.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase text-slate-500">Guide desks</p><p className="mt-2 text-2xl font-semibold">{guideRows.length}</p></article>
        <article className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase text-slate-500">Assigned MSMEs</p><p className="mt-2 text-2xl font-semibold">{guideRows.reduce((sum, row) => sum + row.assignedMsmes.length, 0)}</p></article>
        <article className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase text-slate-500">Need follow-up</p><p className="mt-2 text-2xl font-semibold text-amber-700">{guideRows.reduce((sum, row) => sum + row.followUps.length, 0)}</p></article>
        <article className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase text-slate-500">Outstanding exposure</p><p className="mt-2 text-2xl font-semibold">{formatNaira(guideRows.reduce((sum, row) => sum + row.outstanding, 0))}</p></article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><CalendarClock className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Morning Brief</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Today&apos;s priorities</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Businesses needing activation", value: businessesNeedingActivation, icon: AlertTriangle },
              { label: "Businesses awaiting TIN", value: businessesAwaitingTin, icon: BadgeCheck },
              { label: "Businesses needing bookkeeping", value: businessesNeedingBookkeeping, icon: BookOpenCheck },
              { label: "Businesses not invoicing", value: businessesNotInvoicing, icon: ReceiptText },
              { label: "Compliance follow-ups", value: complianceFollowUps, icon: FileWarning },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border bg-slate-50 p-3">
                <Icon className="h-4 w-4 text-emerald-700" />
                <p className="mt-2 text-2xl font-semibold text-slate-950">{value.toLocaleString("en-NG")}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Target className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Portfolio Health</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Guide performance</h2>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ["Activation progress", averageActivation],
              ["Profile completion", averageProfileCompletion],
              ["Compliance progress", averageCompliance],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="flex justify-between text-xs font-semibold text-slate-600"><span>{label}</span><span>{value}%</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${value}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Top performing guide desk</p>
            <p className="mt-1 font-semibold text-slate-950">{topGuide?.guideName ?? "Available after wider rollout"}</p>
            <p className="text-sm text-slate-600">{topGuide ? `${topGuide.state} • ${topGuide.lga}` : "No guide portfolio available yet."}</p>
          </div>
        </article>
      </div>

      <article className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><ClipboardList className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Next Recommended Actions</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Operational focus for the next cycle</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            businessesAwaitingTin > 0 ? "Prioritise TIN-readiness follow-up for businesses missing tax identity linkage." : "Maintain TIN-readiness monitoring across active guide desks.",
            businessesNotInvoicing > 0 ? "Activate digital invoicing support for businesses without invoice activity." : "Use invoice activity to identify growth and compliance patterns.",
            complianceFollowUps > 0 ? "Escalate compliance evidence follow-ups for guide desks with unresolved exposure." : "Maintain compliance cadence and monitor new risk signals.",
          ].map((item) => (
            <p key={item} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-950">{item}</p>
          ))}
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        {guideRows.length === 0 && <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">No MSMEs are available for Revenue Guide assignment yet.</p>}
        {guideRows.map((guide) => (
          <article key={guide.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{guide.guideName}</h2>
                <p className="text-sm text-slate-600">{guide.state} • {guide.lga}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{guide.assignedMsmes.length} assigned MSMEs</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Activation</p><p className="text-xl font-semibold">{guide.activationProgress}%</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Profile completion</p><p className="text-xl font-semibold">{guide.profileCompletion}%</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Compliance</p><p className="text-xl font-semibold">{guide.complianceRate}%</p></div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Last engagement</p>
                <p className="mt-1 text-sm text-slate-800">{dateLabel(guide.lastEngagement)}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Next action</p>
                <p className="mt-1 text-sm text-slate-800">{guide.nextAction}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-900">Businesses needing follow-up</p>
              <div className="mt-2 space-y-2">
                {guide.followUps.slice(0, 4).map((msme) => {
                  const tax = taxByMsme.get(msme.id);
                  const compliance = complianceByMsme.get(msme.id);
                  return (
                    <Link key={msme.id} href={`/dashboard/nrs/${msme.msme_id}`} className="block rounded-xl border p-3 text-sm transition hover:border-emerald-300 hover:bg-emerald-50/40">
                      <span className="font-medium text-slate-950">{msme.business_name ?? msme.msme_id}</span>
                      <span className="ml-2 text-xs text-slate-500">{msme.sector ?? "Unclassified"}</span>
                      <span className="mt-1 block text-xs text-slate-600">
                        {formatNrsStatus(tax?.compliance_status ?? compliance?.overall_status)} • Outstanding {formatNaira(tax?.outstanding_amount ?? 0)}
                      </span>
                    </Link>
                  );
                })}
                {guide.followUps.length === 0 && <p className="rounded-xl border border-dashed p-3 text-sm text-slate-500">No immediate follow-up required.</p>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
