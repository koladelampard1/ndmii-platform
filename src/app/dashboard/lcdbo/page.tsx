import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Building2, CalendarDays, Factory, FileText, Landmark, Network, Target, Users } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { LCDBO_MODULE_KEY, LCDBO_PROGRAMME_SLUG, programmeLabel } from "@/lib/lcdbo/content";
import { loadLcdboPublicData, loadLcdboProgramme } from "@/lib/lcdbo/data";

const workspaceCards = [
  { title: "Programme Overview", detail: "Programme profile, ownership, partners, and module access.", icon: Building2, href: "/lcdbo/model" },
  { title: "Registered MSMEs", detail: "Future LCDBO enrolment and MSME registry workspace.", icon: Users, href: "/dashboard/admin/msmes" },
  { title: "Clusters", detail: "Pilot industrial cluster registry foundation.", icon: Factory, href: "/lcdbo/clusters" },
  { title: "Partners", detail: "Institution and partner ecosystem.", icon: Network, href: "/lcdbo/partners" },
  { title: "Opportunities", detail: "MSME, investor, state, and partner tracks.", icon: Target, href: "/lcdbo/opportunities" },
  { title: "Funding Pipeline", detail: "Reserved for future funding hub integration.", icon: Landmark, href: "/lcdbo/opportunities" },
  { title: "Events", detail: "Programme briefings and mobilisation calendar.", icon: CalendarDays, href: "/lcdbo/events" },
  { title: "Reports", detail: "Reserved for evidence-backed programme reporting.", icon: FileText, href: "/dashboard/impact-intelligence/reports" },
  { title: "Impact Metrics", detail: "Reserved for LCDBO programme indicators.", icon: BarChart3, href: "/dashboard/impact-intelligence/analytics" },
];

export default async function LcdboDashboardPage() {
  const ctx = await getCurrentUserContext();
  const programme = await loadLcdboProgramme();
  const moduleAccess = await canUseWorkspaceModule({
    ctx,
    moduleKey: LCDBO_MODULE_KEY,
    allowedRoles: ["programme_officer", "admin", "super_admin", "institution_admin"],
    scopeType: "programme",
    scopeId: programme?.id ?? null,
    programmeId: programme?.id ?? null,
    institutionId: programme?.owning_institution_id ?? null,
  }).catch((error) => {
    console.warn("[lcdbo-workspace] module access fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      allowed: isPlatformAdmin(ctx.role),
      roles: [ctx.role],
      source: isPlatformAdmin(ctx.role) ? "platform_admin" as const : "denied" as const,
      module: { allowed: isPlatformAdmin(ctx.role), status: "fallback", source: "module" as const },
    };
  });

  if (!moduleAccess.allowed) redirect("/access-denied");

  const data = await loadLcdboPublicData();
  const totalInvestment = data.clusters.reduce((sum, cluster) => sum + (cluster.investmentRequired ?? 0), 0);
  const totalJobs = data.clusters.reduce((sum, cluster) => sum + (cluster.jobsTarget ?? 0), 0);
  const totalMsmes = data.clusters.reduce((sum, cluster) => sum + (cluster.msmeTarget ?? 0), 0);

  return (
    <main className="min-h-screen bg-[#eef2f7] text-slate-900">
      <section className="border-b border-white/10 bg-[#06172f] text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f2c76b]">Programme Workspace</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{programmeLabel(programme)}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Authenticated LCDBO shell running inside DBIN. This is a workspace foundation, not a separate application.</p>
            </div>
            <Link href="/lcdbo" className="inline-flex rounded-md border border-white/20 px-4 py-3 text-sm font-black text-white">
              Public Site
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Kpi label="Workspace module" value={moduleAccess.module.status ?? "enabled"} />
          <Kpi label="Pilot clusters" value={data.clusters.length.toLocaleString("en-NG")} />
          <Kpi label="MSME target" value={totalMsmes.toLocaleString("en-NG")} demo />
          <Kpi label="Jobs target" value={totalJobs.toLocaleString("en-NG")} demo />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#06172f]">Programme operating snapshot</h2>
              <p className="mt-1 text-sm text-slate-600">Seed/sample foundation data. Real metrics should be wired from enrolments, cluster members, events, funding records, and impact indicators in later phases.</p>
            </div>
            <span className="rounded-full bg-[#d9a441]/15 px-3 py-1 text-xs font-black text-[#72520c]">Demo baseline</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Kpi label="Partner institutions" value={data.partners.length.toLocaleString("en-NG")} />
            <Kpi label="Investment required" value={`₦${totalInvestment.toLocaleString("en-NG")}`} demo />
            <Kpi label="Programme slug" value={programme?.slug ?? LCDBO_PROGRAMME_SLUG} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaceCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} href={card.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#d9a441]">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#1f8a5b]/10 text-[#1f8a5b]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-black text-[#06172f]">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.detail}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#0d5f42]">
                  Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value, demo = false }: { label: string; value: string; demo?: boolean }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
        {demo ? <span className="rounded-full bg-[#d9a441]/15 px-2 py-0.5 text-[10px] font-black text-[#72520c]">Demo</span> : null}
      </div>
      <p className="mt-2 truncate text-2xl font-black text-[#06172f]">{value}</p>
    </article>
  );
}
