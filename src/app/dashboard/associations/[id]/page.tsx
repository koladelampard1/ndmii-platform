import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function associationDetailAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const id = String(formData.get("association_id"));
  if (ctx.role === "association_officer" && id !== ctx.linkedAssociationId) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  await supabase.from("associations").update({
    name: String(formData.get("name")),
    sector: String(formData.get("sector_focus") ?? "General"),
    state: String(formData.get("state")),
    lga_coverage: String(formData.get("lga_coverage") ?? ""),
    profile: String(formData.get("profile") ?? ""),
    contact_email: String(formData.get("contact_email") ?? "") || null,
    contact_phone: String(formData.get("contact_phone") ?? "") || null,
    status: String(formData.get("status") ?? "active"),
  }).eq("id", id);

  redirect(`/dashboard/associations/${id}?saved=1`);
}

export default async function AssociationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");
  if (ctx.role === "association_officer" && id !== ctx.linkedAssociationId) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const [{ data: association }, { data: members }] = await Promise.all([
    supabase.from("associations").select("id,name,state,sector,lga_coverage,profile,status,contact_email,contact_phone").eq("id", id).maybeSingle(),
    supabase
      .from("msmes")
      .select("id,msme_id,business_name,state,sector,verification_status")
      .eq("association_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (!association) return <main className="rounded border bg-white p-6">Association not found.</main>;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Association Details</h1>
      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Association profile updated.</p>}

      <form action={associationDetailAction} className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
        <input type="hidden" name="association_id" value={association.id} />
        <input name="name" defaultValue={association.name} className="rounded border px-2 py-2 text-sm" />
        <input name="sector_focus" defaultValue={association.sector} className="rounded border px-2 py-2 text-sm" />
        <input name="state" defaultValue={association.state} className="rounded border px-2 py-2 text-sm" />
        <input name="lga_coverage" defaultValue={association.lga_coverage ?? ""} className="rounded border px-2 py-2 text-sm" />
        <input name="contact_email" defaultValue={association.contact_email ?? ""} className="rounded border px-2 py-2 text-sm" />
        <input name="contact_phone" defaultValue={association.contact_phone ?? ""} className="rounded border px-2 py-2 text-sm" />
        <select name="status" defaultValue={association.status ?? "active"} className="rounded border px-2 py-2 text-sm"><option>active</option><option>inactive</option><option>under review</option></select>
        <input name="profile" defaultValue={association.profile ?? ""} className="rounded border px-2 py-2 text-sm md:col-span-3" />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Save association details</button>
      </form>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Member coverage ({(members ?? []).length})</h2>
        <div className="mt-2 space-y-2 text-sm">
          {(members ?? []).map((member) => (
            <p key={member.id} className="rounded border p-2">{member.business_name} • {member.msme_id} • {member.verification_status ?? "pending_review"}</p>
          ))}
          {(members ?? []).length === 0 && <p className="text-slate-500">No linked members yet.</p>}
        </div>
      </article>
    </section>
  );
}
