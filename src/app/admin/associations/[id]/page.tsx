import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function updateAssociationAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const associationId = String(formData.get("association_id") ?? "");
  const supabase = await createServerSupabaseClient();

  await supabase
    .from("associations")
    .update({
      name: String(formData.get("name") ?? ""),
      state: String(formData.get("location") ?? ""),
      sector: String(formData.get("category") ?? "General"),
    })
    .eq("id", associationId);

  revalidatePath(`/admin/associations/${associationId}`);
  redirect(`/admin/associations/${associationId}?saved=1`);
}

export default async function AdminAssociationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();

  const [{ data: association }, { data: members }] = await Promise.all([
    supabase
      .from("associations")
      .select("id,name,state,sector,created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("association_members")
      .select("invite_status,activated_at")
      .eq("association_id", id),
  ]);

  if (!association) {
    return <main className="rounded border bg-white p-6">Association not found.</main>;
  }

  const totalUploaded = members?.length ?? 0;
  const invited = members?.filter((item) => item.invite_status === "INVITED").length ?? 0;
  const activated = members?.filter((item) => item.invite_status === "ACTIVATED").length ?? 0;
  const failed = members?.filter((item) => item.invite_status === "FAILED").length ?? 0;
  const pending = invited;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Association Admin: {association.name}</h1>
        <div className="flex gap-2 text-xs">
          <Link href={`/admin/associations/${id}/upload-members`} className="rounded border px-2 py-1">Upload members</Link>
          <Link href={`/admin/associations/${id}/members`} className="rounded border px-2 py-1">View members</Link>
          <Link href="/admin/associations" className="rounded border px-2 py-1">Back to associations</Link>
        </div>
      </div>

      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Association updated successfully.</p>}

      <div className="grid gap-3 md:grid-cols-5">
        <article className="rounded border bg-white p-3"><p className="text-xs uppercase text-slate-500">Total uploaded</p><p className="text-2xl font-semibold">{totalUploaded}</p></article>
        <article className="rounded border bg-white p-3"><p className="text-xs uppercase text-slate-500">Invited</p><p className="text-2xl font-semibold">{invited}</p></article>
        <article className="rounded border bg-white p-3"><p className="text-xs uppercase text-slate-500">Activated</p><p className="text-2xl font-semibold">{activated}</p></article>
        <article className="rounded border bg-white p-3"><p className="text-xs uppercase text-slate-500">Pending activation</p><p className="text-2xl font-semibold">{pending}</p></article>
        <article className="rounded border bg-white p-3"><p className="text-xs uppercase text-slate-500">Failed invites</p><p className="text-2xl font-semibold">{failed}</p></article>
      </div>

      <form action={updateAssociationAction} className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-2">
        <input type="hidden" name="association_id" value={association.id} />
        <input name="name" defaultValue={association.name} required className="rounded border px-2 py-2 text-sm" />
        <input name="category" defaultValue={association.sector ?? ""} required className="rounded border px-2 py-2 text-sm" />
        <input name="contact_person_name" defaultValue="" className="rounded border px-2 py-2 text-sm" placeholder="Contact person (not configured in current schema)" />
        <input name="contact_email" defaultValue="" className="rounded border px-2 py-2 text-sm" placeholder="Contact email (not configured in current schema)" />
        <input name="contact_phone" defaultValue="" className="rounded border px-2 py-2 text-sm" placeholder="Contact phone (not configured in current schema)" />
        <input name="location" defaultValue={association.state ?? ""} required className="rounded border px-2 py-2 text-sm" />
        <input name="logo_url" defaultValue="" className="rounded border px-2 py-2 text-sm md:col-span-2" placeholder="Logo URL (not configured in current schema)" />
        <select name="status" defaultValue="ACTIVE" className="rounded border px-2 py-2 text-sm">
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Save association</button>
      </form>
    </section>
  );
}
