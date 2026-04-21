import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function createAssociationAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const payload = {
    name: String(formData.get("name") ?? ""),
    state: String(formData.get("location") ?? ""),
    sector: String(formData.get("category") ?? "General"),
  };

  const unsupportedFormFields = {
    category: String(formData.get("category") ?? "General"),
    contact_person_name: String(formData.get("contact_person_name") ?? ""),
    contact_email: String(formData.get("contact_email") ?? "") || null,
    contact_phone: String(formData.get("contact_phone") ?? "") || null,
    location: String(formData.get("location") ?? ""),
    logo_url: String(formData.get("logo_url") ?? "") || null,
    status: String(formData.get("status") ?? "ACTIVE"),
    created_by_admin_id: ctx.appUserId,
  };

  console.info("[admin-associations:create] table=associations payload", payload);
  console.info("[admin-associations:create] omitted unsupported fields", unsupportedFormFields);

  const { data: insertedAssociation, error } = await supabase
    .from("associations")
    .insert(payload)
    .select("id,name,state,sector,created_at")
    .single();

  if (error) {
    console.error("[admin-associations:create] insert failed", {
      table: "associations",
      attemptedPayload: payload,
      omittedUnsupportedFields: unsupportedFormFields,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    redirect("/admin/associations?error=create_failed");
  }

  console.info("[admin-associations:create] insert success", {
    table: "associations",
    insertedId: insertedAssociation.id,
    insertedRow: insertedAssociation,
  });

  revalidatePath("/admin/associations");
  revalidatePath("/dashboard/associations");
  redirect(`/admin/associations?saved=1&id=${insertedAssociation.id}`);
}

export default async function AdminAssociationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const [{ data: associations }, { data: members }] = await Promise.all([
    supabase
      .from("associations")
      .select("id,name,state,sector,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("msmes").select("association_id,id").not("association_id", "is", null),
  ]);

  const countByAssociation = new Map<string, number>();
  (members ?? []).forEach((member) => {
    countByAssociation.set(member.association_id, (countByAssociation.get(member.association_id) ?? 0) + 1);
  });

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Admin Association Bulk Upload Engine</h1>
        <Link href="/dashboard/associations" className="rounded border px-3 py-2 text-sm">
          Open association workspace
        </Link>
      </div>

      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Association created successfully.</p>}
      {params.error === "create_failed" && <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">Association creation failed. Please check server logs for details.</p>}

      <div className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-2">
        <article>
          <h2 className="font-semibold">Create association</h2>
          <p className="text-sm text-slate-600">Designed for high-volume Abuja artisan association onboarding.</p>
          <form action={createAssociationAction} className="mt-3 grid gap-2 md:grid-cols-2">
            <input name="name" required placeholder="Association name" className="rounded border px-2 py-2 text-sm" />
            <input name="category" required placeholder="Sector / category" className="rounded border px-2 py-2 text-sm" />
            <input name="contact_person_name" required placeholder="Contact person" className="rounded border px-2 py-2 text-sm" />
            <input name="contact_email" type="email" placeholder="Contact email" className="rounded border px-2 py-2 text-sm" />
            <input name="contact_phone" placeholder="Contact phone" className="rounded border px-2 py-2 text-sm" />
            <input name="location" required placeholder="State" className="rounded border px-2 py-2 text-sm" />
            <input name="logo_url" placeholder="Logo URL (optional)" className="rounded border px-2 py-2 text-sm md:col-span-2" />
            <select name="status" defaultValue="ACTIVE" className="rounded border px-2 py-2 text-sm">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create association</button>
          </form>
        </article>

        <article className="rounded-lg border bg-slate-50 p-4">
          <h3 className="font-semibold">Quick links</h3>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <a href="/api/admin/associations/template?format=csv" className="text-emerald-700 hover:underline">
                Download MSME Upload Template (CSV)
              </a>
            </li>
          </ul>
        </article>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(associations ?? []).map((association) => (
          <article key={association.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">{association.name}</h2>
            <p className="text-sm text-slate-600">
              {association.sector ?? "General"} • {association.state ?? "N/A"}
            </p>
            <p className="text-xs text-slate-500">Members linked: {countByAssociation.get(association.id) ?? 0}</p>
            <div className="mt-3 flex gap-2 text-xs">
              <Link href={`/admin/associations/${association.id}`} className="rounded border px-2 py-1">
                Manage
              </Link>
              <Link href={`/admin/associations/${association.id}/upload-members`} className="rounded border px-2 py-1">
                Upload members
              </Link>
              <Link href={`/admin/associations/${association.id}/members`} className="rounded border px-2 py-1">
                View members
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
