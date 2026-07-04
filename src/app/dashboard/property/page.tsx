import Link from "next/link";
import { ClipboardCheck, FileClock, FileText, Home, PlusCircle, ShieldCheck } from "lucide-react";
import { PropertyMetricCard, PropertyStatusBadge, PropertyWorkspaceHero, RegistrationGuide } from "@/components/property/property-workspace";
import { listMyProperties, requirePropertyWorkspaceAccess } from "@/app/dashboard/property/_queries";

export const dynamic = "force-dynamic";

function countByStatus(properties: Awaited<ReturnType<typeof listMyProperties>>) {
  return {
    drafts: properties.filter((property) => property.status === "draft").length,
    submitted: properties.filter((property) => ["submitted", "under_review"].includes(property.status)).length,
    verified: properties.filter((property) => ["verified", "active"].includes(property.status)).length,
  };
}

export default async function PropertyWorkspacePage() {
  const { ctx, supabase } = await requirePropertyWorkspaceAccess();
  const properties = await listMyProperties(supabase, ctx.appUserId!);
  const counts = countByStatus(properties);
  const recent = properties.slice(0, 5);

  return (
    <main className="space-y-6">
      <PropertyWorkspaceHero
        eyebrow="Digital Land & Property Infrastructure"
        title="Property Registration Workspace"
        description="Start, save and submit digital property registration applications using DBIN’s registry foundation."
        actions={[
          { href: "/dashboard/property/register", label: "Register Property", primary: true },
          { href: "/dashboard/property/my-properties", label: "My Properties" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PropertyMetricCard icon={Home} label="Total applications" value={properties.length} detail="All property records started from this workspace." />
        <PropertyMetricCard icon={FileClock} label="Drafts" value={counts.drafts} detail="Saved applications that can still be updated." />
        <PropertyMetricCard icon={ClipboardCheck} label="Submitted" value={counts.submitted} detail="Applications sent into the registry pipeline." />
        <PropertyMetricCard icon={ShieldCheck} label="Verified" value={counts.verified} detail="Placeholder count for future registry review outcomes." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Recent activity</p>
              <h2 className="mt-1 text-2xl font-black text-[#06172f]">Latest property applications</h2>
            </div>
            <Link href="/dashboard/property/my-properties" className="text-sm font-black text-[#008751]">View all</Link>
          </div>
          <div className="mt-5 space-y-3">
            {recent.length ? recent.map((property) => (
              <div key={property.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-[#06172f]">{property.title || property.property_type.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs text-slate-500">{property.application_reference || "Draft application"} · Updated {new Date(property.updated_at).toLocaleDateString("en-NG")}</p>
                </div>
                <PropertyStatusBadge status={property.status} />
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <FileText className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-3 text-lg font-black text-[#06172f]">No registration activity yet</h3>
                <p className="mt-1 text-sm text-slate-500">Start your first digital property registration when ready.</p>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Quick actions</p>
          <div className="mt-5 grid gap-3">
            <Link href="/dashboard/property/register" className="flex items-center justify-between rounded-2xl bg-[#06172f] p-4 text-white transition hover:-translate-y-0.5">
              <span className="inline-flex items-center gap-3 font-black"><PlusCircle className="h-5 w-5" />Start registration</span>
            </Link>
            <Link href="/dashboard/property/drafts" className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 font-black text-[#06172f] transition hover:-translate-y-0.5 hover:border-[#008751]/30">
              <span className="inline-flex items-center gap-3"><FileClock className="h-5 w-5 text-[#008751]" />Resume drafts</span>
            </Link>
            <Link href="/dashboard/property/my-properties" className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 font-black text-[#06172f] transition hover:-translate-y-0.5 hover:border-[#008751]/30">
              <span className="inline-flex items-center gap-3"><Home className="h-5 w-5 text-[#008751]" />View applications</span>
            </Link>
          </div>
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Future DLPI items such as verification, GIS, reports and marketplace are intentionally not enabled in this phase.
          </div>
        </article>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Registration guide</p>
          <h2 className="mt-1 text-2xl font-black text-[#06172f]">How to prepare a clean application</h2>
        </div>
        <RegistrationGuide />
      </section>
    </main>
  );
}
