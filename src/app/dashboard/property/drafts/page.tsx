import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deletePropertyDraftAction } from "@/app/dashboard/property/actions";
import { listMyProperties, requirePropertyWorkspaceAccess } from "@/app/dashboard/property/_queries";
import { PropertyStatusBadge, PropertyWorkspaceHero } from "@/components/property/property-workspace";

export const dynamic = "force-dynamic";

export default async function PropertyDraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const query = await searchParams;
  const { ctx, supabase } = await requirePropertyWorkspaceAccess();
  const drafts = (await listMyProperties(supabase, ctx.appUserId!)).filter((property) => property.status === "draft");

  return (
    <main className="space-y-6">
      <PropertyWorkspaceHero
        eyebrow="Draft applications"
        title="Resume Property Registration Drafts"
        description="Continue saved property applications or remove drafts that are no longer needed."
        actions={[
          { href: "/dashboard/property/register", label: "New Registration", primary: true },
          { href: "/dashboard/property/my-properties", label: "My Properties" },
        ]}
      />
      {query.success === "draft_deleted" ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Draft deleted successfully.</p> : null}

      {drafts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {drafts.map((draft) => (
            <article key={draft.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#008751]">Draft</p>
                  <h2 className="mt-1 text-2xl font-black text-[#06172f]">{draft.title || draft.property_type.replaceAll("_", " ")}</h2>
                  <p className="mt-2 text-sm text-slate-500">Last updated {new Date(draft.updated_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p>
                </div>
                <PropertyStatusBadge status={draft.status} />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{draft.primaryAddress?.traditional_description || draft.description || "Location and description can be completed when you resume this draft."}</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Link href={`/dashboard/property/register?property=${draft.id}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#06172f] px-4 text-sm font-black text-white">Resume Draft</Link>
                <form action={deletePropertyDraftAction}>
                  <input type="hidden" name="property_id" value={draft.id} />
                  <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-black text-rose-700" type="submit">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-black text-[#06172f]">No draft applications</h2>
          <p className="mt-2 text-sm text-slate-500">Saved property registration drafts will appear here.</p>
          <Link href="/dashboard/property/register" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#06172f] px-4 text-sm font-black text-white">Start Registration</Link>
        </div>
      )}
    </main>
  );
}
