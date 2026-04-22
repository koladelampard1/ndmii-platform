import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { mergeSupportedSectors } from "@/lib/constants/sectors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function associationAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const supabase = await createServerSupabaseClient();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const kind = String(formData.get("kind"));
  const associationId = String(formData.get("association_id") ?? "");

  if (kind === "create" && ctx.role === "admin") {
    await supabase.from("associations").insert({
      name: String(formData.get("name")),
      sector: String(formData.get("sector_focus") ?? "General"),
      state: String(formData.get("state")),
      lga_coverage: String(formData.get("lga_coverage") ?? ""),
      profile: String(formData.get("profile") ?? ""),
      contact_email: String(formData.get("contact_email") ?? null) || null,
      contact_phone: String(formData.get("contact_phone") ?? null) || null,
      status: String(formData.get("status") ?? "active"),
    });
  }

  if (kind === "update") {
    if (ctx.role === "association_officer" && associationId !== ctx.linkedAssociationId) redirect("/access-denied");
    await supabase
      .from("associations")
      .update({
        name: String(formData.get("name")),
        sector: String(formData.get("sector_focus") ?? "General"),
        state: String(formData.get("state")),
        lga_coverage: String(formData.get("lga_coverage") ?? ""),
        profile: String(formData.get("profile") ?? ""),
        contact_email: String(formData.get("contact_email") ?? null) || null,
        contact_phone: String(formData.get("contact_phone") ?? null) || null,
        status: String(formData.get("status") ?? "active"),
      })
      .eq("id", associationId);
  }

  redirect("/dashboard/associations?saved=1");
}

export default async function AssociationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; sector?: string; sort?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("associations")
    .select("id,name,state,sector,lga_coverage,profile,status,contact_email,contact_phone")
    .order(params.sort === "members" ? "name" : "created_at", { ascending: true });

  if (ctx.role === "association_officer") query = query.eq("id", ctx.linkedAssociationId ?? "");
  const { data: associations } = await query;

  const { data: members } = await supabase.from("association_members").select("association_id,id");
  const counts = new Map<string, number>();
  (members ?? []).forEach((m) => counts.set(m.association_id, (counts.get(m.association_id) ?? 0) + 1));

  let rows = associations ?? [];
  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter((a) => a.name.toLowerCase().includes(q) || (a.profile ?? "").toLowerCase().includes(q));
  }
  if (params.state) rows = rows.filter((a) => a.state === params.state);
  if (params.sector) rows = rows.filter((a) => a.sector === params.sector);
  if (params.sort === "members") rows = [...rows].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  const sectorOptions = mergeSupportedSectors(rows.map((association) => association.sector));

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Association Management Console</h1><Link href="/dashboard/associations/bulk-upload" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Bulk upload members</Link></div>
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Association changes saved.</p>}

      <div className="grid gap-3 md:grid-cols-4">
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Associations</p><p className="text-2xl font-semibold">{rows.length}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Total linked members</p><p className="text-2xl font-semibold">{rows.reduce((sum, r) => sum + (counts.get(r.id) ?? 0), 0)}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">States covered</p><p className="text-2xl font-semibold">{new Set(rows.map((r) => r.state)).size}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Active associations</p><p className="text-2xl font-semibold">{rows.filter((r) => (r.status ?? "active") === "active").length}</p></article>
      </div>

      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-5">
        <datalist id="association-sector-options">
          {sectorOptions.map((sector) => <option key={sector} value={sector} />)}
        </datalist>
        <input name="q" defaultValue={params.q} placeholder="Search name/profile" className="rounded border px-2 py-2 text-sm" />
        <input name="state" defaultValue={params.state} placeholder="State" className="rounded border px-2 py-2 text-sm" />
        <input name="sector" list="association-sector-options" defaultValue={params.sector} placeholder="Sector" className="rounded border px-2 py-2 text-sm" />
        <select name="sort" defaultValue={params.sort} className="rounded border px-2 py-2 text-sm"><option value="">Newest</option><option value="members">Member count</option></select>
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply</button>
      </form>

      {ctx.role === "admin" && (
        <form action={associationAction} className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
          <input type="hidden" name="kind" value="create" />
          <input name="name" required placeholder="Association name" className="rounded border px-2 py-2 text-sm" />
          <input name="sector_focus" list="association-sector-options" placeholder="Sector focus" className="rounded border px-2 py-2 text-sm" />
          <input name="state" placeholder="State" className="rounded border px-2 py-2 text-sm" />
          <input name="lga_coverage" placeholder="LGA coverage" className="rounded border px-2 py-2 text-sm" />
          <input name="contact_email" placeholder="Contact email" className="rounded border px-2 py-2 text-sm" />
          <input name="contact_phone" placeholder="Contact phone" className="rounded border px-2 py-2 text-sm" />
          <select name="status" className="rounded border px-2 py-2 text-sm"><option>active</option><option>inactive</option><option>under review</option></select>
          <input name="profile" placeholder="Association summary" className="rounded border px-2 py-2 text-sm md:col-span-3" />
          <button className="rounded bg-emerald-800 px-3 py-2 text-sm text-white">Create new association</button>
        </form>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((association) => (
          <article key={association.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{association.name}</h2>
                <p className="text-sm text-slate-600">{association.sector} • {association.state} • {association.status ?? "active"}</p>
                <p className="text-xs text-slate-500">Members: {counts.get(association.id) ?? 0} • LGA: {association.lga_coverage || "n/a"}</p>
              </div>
              <Link href={`/dashboard/associations/${association.id}`} className="rounded border px-3 py-1 text-xs">Open details</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
