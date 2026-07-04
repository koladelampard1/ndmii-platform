import { Home, PlusCircle } from "lucide-react";
import { PropertyTable, PropertyWorkspaceHero } from "@/components/property/property-workspace";
import { listMyProperties, requirePropertyWorkspaceAccess } from "@/app/dashboard/property/_queries";

export const dynamic = "force-dynamic";

export default async function MyPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const query = await searchParams;
  const { ctx, supabase } = await requirePropertyWorkspaceAccess();
  const properties = (await listMyProperties(supabase, ctx.appUserId!)).filter((property) => property.status !== "draft");

  return (
    <main className="space-y-6">
      <PropertyWorkspaceHero
        eyebrow="My property applications"
        title="Submitted and Active Property Records"
        description="Track draft-submitted, under-review and verified property registration records associated with your DBIN account."
        actions={[
          { href: "/dashboard/property/register", label: "Register Property", primary: true },
          { href: "/dashboard/property/drafts", label: "Drafts" },
        ]}
      />
      {query.success === "submitted" ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Property registration submitted for review.</p> : null}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Home className="h-6 w-6 text-[#008751]" />
          <p className="mt-3 text-2xl font-black text-[#06172f]">{properties.length}</p>
          <p className="mt-1 text-sm text-slate-500">Non-draft property applications</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PlusCircle className="h-6 w-6 text-[#008751]" />
          <p className="mt-3 text-2xl font-black text-[#06172f]">{properties.filter((property) => property.application_reference).length}</p>
          <p className="mt-1 text-sm text-slate-500">Records with application reference</p>
        </div>
      </section>
      <PropertyTable properties={properties} emptyTitle="No submitted property applications" emptyDetail="Submitted property registrations will appear here after you send them for review." />
    </main>
  );
}
