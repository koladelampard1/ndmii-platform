import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, BarChart3, Building2, Factory, FileText, Landmark, Network, Users } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import {
  getLcdboClusterInterestQueue,
  getLcdboEnrolmentQueue,
  getLcdboProgramme,
  getLcdboRecentActivity,
  listLcdboClusters,
  updateLcdboClusterInterestStatus,
  updateLcdboEnrolmentStatus,
} from "@/lib/data/lcdbo-enrolment";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { LCDBO_MODULE_KEY, LCDBO_PROGRAMME_SLUG, programmeLabel } from "@/lib/lcdbo/content";
import type { ClusterInterestStatus, ProgrammeEnrolmentStatus } from "@/types/platform";

const REVIEW_ROLES = ["programme_officer", "admin", "super_admin", "institution_admin"] as const;

const workspaceCards = [
  { title: "Programme model", detail: "Ownership, partners, delivery model, and public programme narrative.", icon: Building2, href: "/lcdbo/model" },
  { title: "Industrial clusters", detail: "Pilot cluster locations, capabilities, and participation demand.", icon: Factory, href: "/lcdbo/clusters" },
  { title: "Partner ecosystem", detail: "Institutions supporting delivery across the programme.", icon: Network, href: "/lcdbo/partners" },
  { title: "Impact reports", detail: "Evidence-backed programme reporting and assurance.", icon: FileText, href: "/dashboard/impact-intelligence/reports" },
  { title: "Impact analytics", detail: "Programme indicators, monitoring, and outcome intelligence.", icon: BarChart3, href: "/dashboard/impact-intelligence/analytics" },
  { title: "Opportunities", detail: "Published MSME and institutional participation tracks.", icon: Landmark, href: "/lcdbo/opportunities" },
];

function statusClass(status: string) {
  if (["active", "accepted"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["rejected", "suspended"].includes(status)) return "bg-rose-100 text-rose-800";
  if (["pending_review", "interested", "under_review", "waitlisted"].includes(status)) return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

async function requireLcdboReviewer() {
  const ctx = await getCurrentUserContext();
  const programme = await getLcdboProgramme();
  if (!programme) redirect("/access-denied");
  const access = await canUseWorkspaceModule({
    ctx,
    moduleKey: LCDBO_MODULE_KEY,
    allowedRoles: REVIEW_ROLES,
    scopeType: "programme",
    scopeId: programme.id,
    programmeId: programme.id,
    institutionId: programme.owning_institution_id,
  }).catch(() => ({
    allowed: isPlatformAdmin(ctx.role),
    roles: [ctx.role],
    source: isPlatformAdmin(ctx.role) ? "platform_admin" as const : "denied" as const,
    module: { allowed: isPlatformAdmin(ctx.role), status: "fallback", source: "module" as const },
  }));
  if (!access.allowed || !ctx.appUserId) redirect("/access-denied");
  return { ctx, programme, access };
}

async function reviewEnrolmentAction(formData: FormData) {
  "use server";
  const { ctx, programme } = await requireLcdboReviewer();
  const enrolmentId = String(formData.get("enrolment_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const reviewNote = String(formData.get("review_note") ?? "").trim();
  const status: ProgrammeEnrolmentStatus | null = action === "approve" ? "active" : action === "reject" ? "rejected" : null;
  if (!status || (status === "rejected" && !reviewNote)) redirect("/dashboard/lcdbo?error=review_note_required");

  const supabase = await createServiceRoleSupabaseClient();
  const { data: enrolment } = await supabase
    .from("programme_enrolments")
    .select("id,programme_id,status")
    .eq("id", enrolmentId)
    .eq("programme_id", programme.id)
    .maybeSingle();
  if (!enrolment || enrolment.status !== "pending_review") redirect("/access-denied");
  await updateLcdboEnrolmentStatus({ enrolmentId, status, actorUserId: ctx.appUserId!, reviewNote, client: supabase });
  revalidatePath("/dashboard/lcdbo");
  revalidatePath("/dashboard/msme/lcdbo");
  redirect(`/dashboard/lcdbo?success=enrolment_${action}`);
}

async function reviewClusterInterestAction(formData: FormData) {
  "use server";
  const { ctx, programme } = await requireLcdboReviewer();
  const interestId = String(formData.get("interest_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const reviewNote = String(formData.get("review_note") ?? "").trim();
  const statusMap: Record<string, ClusterInterestStatus> = { accept: "accepted", reject: "rejected", waitlist: "waitlisted" };
  const status = statusMap[action];
  if (!status || (status === "rejected" && !reviewNote)) redirect("/dashboard/lcdbo?error=review_note_required");

  const supabase = await createServiceRoleSupabaseClient();
  const { data: interest } = await supabase
    .from("cluster_members")
    .select("id,status,industrial_clusters!inner(programme_id)")
    .eq("id", interestId)
    .eq("industrial_clusters.programme_id", programme.id)
    .maybeSingle();
  if (!interest || !["interested", "under_review", "waitlisted"].includes(interest.status)) redirect("/access-denied");
  await updateLcdboClusterInterestStatus({ interestId, status, actorUserId: ctx.appUserId!, reviewNote, client: supabase });
  revalidatePath("/dashboard/lcdbo");
  revalidatePath("/dashboard/msme/lcdbo");
  redirect(`/dashboard/lcdbo?success=cluster_interest_${action}`);
}

export default async function LcdboDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { programme, access } = await requireLcdboReviewer();
  const supabase = await createServiceRoleSupabaseClient();
  const [enrolments, interests, clusters] = await Promise.all([
    getLcdboEnrolmentQueue(supabase),
    getLcdboClusterInterestQueue(supabase),
    listLcdboClusters(supabase),
  ]);
  const recentActivity = await getLcdboRecentActivity(programme.id, clusters.map((cluster) => cluster.id), supabase);
  const pendingEnrolments = enrolments.filter((item) => item.status === "pending_review");
  const activeEnrolments = enrolments.filter((item) => item.status === "active");
  const pendingInterests = interests.filter((item) => ["interested", "under_review", "waitlisted"].includes(item.status));
  const sectorCounts = countBy(enrolments.map((item) => item.msme?.sector).filter(Boolean) as string[]);
  const stateCounts = countBy(enrolments.map((item) => item.msme?.state).filter(Boolean) as string[]);

  return (
    <main className="min-h-screen bg-[#eef2f7] text-slate-900">
      <section className="border-b border-white/10 bg-[#06172f] text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f2c76b]">Programme Operations</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{programmeLabel(programme)}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Review MSME enrolments, shape cluster participation, and monitor the programme pipeline from one governed workspace.</p>
            </div>
            <Link href="/lcdbo" className="inline-flex rounded-md border border-white/20 px-4 py-3 text-sm font-black text-white">Public Site</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {query.success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">The LCDBO review decision was recorded.</p>}
        {query.error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">A review note is required when rejecting a request.</p>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Total enrolments" value={enrolments.length} />
          <Kpi label="Pending review" value={pendingEnrolments.length} attention />
          <Kpi label="Active MSMEs" value={activeEnrolments.length} />
          <Kpi label="Cluster requests" value={pendingInterests.length} attention />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.5fr,1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-[#06172f]">Enrolment review queue</h2><p className="mt-1 text-sm text-slate-600">New MSME requests awaiting a programme decision.</p></div><Users className="h-5 w-5 text-emerald-700" /></div>
            <div className="mt-5 space-y-3">
              {pendingEnrolments.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-black text-slate-900">{item.msme?.business_name ?? "MSME record"}</p><p className="mt-1 text-xs text-slate-500">{item.msme?.msme_id} · {item.msme?.sector} · {item.msme?.state}</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(item.status)}`}>{humanize(item.status)}</span>
                  </div>
                  {item.application_note && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.application_note}</p>}
                  <form action={reviewEnrolmentAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr,auto,auto]">
                    <input type="hidden" name="enrolment_id" value={item.id} />
                    <input name="review_note" placeholder="Decision note (required for rejection)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <button name="action" value="approve" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white">Approve</button>
                    <button name="action" value="reject" className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700">Reject</button>
                  </form>
                </div>
              ))}
              {!pendingEnrolments.length && <EmptyState text="No enrolment requests are waiting for review." />}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#06172f]">Participation profile</h2>
            <p className="mt-1 text-sm text-slate-600">Leading sectors and states across all enrolment requests.</p>
            <Ranking title="Top sectors" rows={sectorCounts} />
            <Ranking title="Top states" rows={stateCounts} />
          </article>
        </div>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-[#06172f]">Cluster interest review</h2><p className="mt-1 text-sm text-slate-600">Assess capability and fit for LCDBO industrial clusters.</p></div><Factory className="h-5 w-5 text-emerald-700" /></div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {pendingInterests.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-slate-900">{item.msme?.business_name ?? "MSME record"}</p><p className="mt-1 text-xs text-slate-500">{item.cluster?.name ?? "LCDBO cluster"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(item.status)}`}>{humanize(item.status)}</span></div>
                <dl className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs font-bold uppercase text-slate-500">Product/service</dt><dd className="mt-1 text-slate-800">{item.product_or_service || "Not provided"}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-slate-500">Location</dt><dd className="mt-1 text-slate-800">{item.current_location || item.msme?.state}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-slate-500">Interest</dt><dd className="mt-1 text-slate-800">{item.interest_reason || "Not provided"}</dd></div>
                  {item.capacity_summary && <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-slate-500">Capacity</dt><dd className="mt-1 text-slate-800">{item.capacity_summary}</dd></div>}
                </dl>
                <form action={reviewClusterInterestAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr,auto,auto,auto]">
                  <input type="hidden" name="interest_id" value={item.id} />
                  <input name="review_note" placeholder="Decision note" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <button name="action" value="accept" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white">Accept</button>
                  <button name="action" value="waitlist" className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-black text-amber-800">Waitlist</button>
                  <button name="action" value="reject" className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700">Reject</button>
                </form>
              </div>
            ))}
            {!pendingInterests.length && <EmptyState text="No cluster interest requests are waiting for review." />}
          </div>
        </article>

        <div className="grid gap-5 xl:grid-cols-[1fr,1.4fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-emerald-700" /><h2 className="text-xl font-black text-[#06172f]">Recent activity</h2></div>
            <div className="mt-4 space-y-3">
              {recentActivity.map((event) => <div key={event.id} className="border-l-2 border-emerald-200 pl-3"><p className="text-sm font-bold capitalize text-slate-800">{humanize(event.event_type.replace("lcdbo.", ""))}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(event.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p></div>)}
              {!recentActivity.length && <p className="text-sm text-slate-500">Activity will appear as MSMEs join and reviews begin.</p>}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-[#06172f]">Workspace modules</h2><p className="mt-1 text-sm text-slate-600">Operational links connected to the LCDBO programme foundation.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{access.module.status ?? "enabled"}</span></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {workspaceCards.map((card) => { const Icon = card.icon; return <Link key={card.title} href={card.href} className="group rounded-xl border border-slate-200 p-4 hover:border-[#d9a441]"><Icon className="h-5 w-5 text-emerald-700" /><p className="mt-3 font-black text-[#06172f]">{card.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{card.detail}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-800">Open <ArrowRight className="h-3.5 w-3.5" /></span></Link>; })}
            </div>
          </article>
        </div>

        <p className="text-xs text-slate-500">Programme: {programme.slug ?? LCDBO_PROGRAMME_SLUG} · {clusters.length} configured cluster{clusters.length === 1 ? "" : "s"}</p>
      </section>
    </main>
  );
}

function Kpi({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>{attention && value > 0 ? <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> : null}</div><p className="mt-2 text-3xl font-black text-[#06172f]">{value.toLocaleString("en-NG")}</p></article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{text}</div>;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function Ranking({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const max = Math.max(...rows.map(([, count]) => count), 1);
  return <div className="mt-5"><h3 className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</h3><div className="mt-3 space-y-3">{rows.map(([label, count]) => <div key={label}><div className="flex justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><span className="font-black text-slate-900">{count}</span></div><div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${(count / max) * 100}%` }} /></div></div>)}{!rows.length && <p className="text-sm text-slate-500">No enrolment data yet.</p>}</div></div>;
}
