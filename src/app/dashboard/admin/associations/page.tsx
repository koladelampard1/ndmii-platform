import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AssociationRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  profile: string | null;
  status: string | null;
  created_at: string | null;
};

type AssociationMemberRow = {
  association_id: string | null;
};

function slugifyAssociationName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "association";
}

async function buildUniqueAssociationSlug(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  name: string,
  currentAssociationId?: string,
) {
  const baseSlug = slugifyAssociationName(name);
  const { data } = await supabase.from("associations").select("id,slug").ilike("slug", `${baseSlug}%`);
  const existingSlugs = new Set(
    (data ?? [])
      .filter((association) => association.id !== currentAssociationId)
      .map((association) => association.slug)
      .filter(Boolean),
  );

  if (!existingSlugs.has(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existingSlugs.has(`${baseSlug}-${suffix}`)) suffix += 1;
  return `${baseSlug}-${suffix}`;
}

function normalizeAssociationStatus(value: FormDataEntryValue | null) {
  return String(value ?? "active").toLowerCase() === "inactive" ? "inactive" : "active";
}

async function associationAdminAction(formData: FormData) {
  "use server";

  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const intent = String(formData.get("action") ?? formData.get("intent") ?? "");
  const associationId = String(formData.get("association_id") ?? "");

  if (intent === "deactivate") {
    if (!associationId) redirect("/dashboard/admin/associations?error=missing_association");

    await supabase.from("associations").update({ status: "inactive" }).eq("id", associationId);
    revalidatePath("/dashboard/admin/associations");
    revalidatePath("/api/auth/register/associations");
    redirect("/dashboard/admin/associations?saved=deactivated");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = normalizeAssociationStatus(formData.get("status"));

  if (!name) redirect("/dashboard/admin/associations?error=name_required");

  if (intent === "create") {
    const slug = await buildUniqueAssociationSlug(supabase, name);
    const { error } = await supabase.from("associations").insert({
      name,
      slug,
      description: description || null,
      profile: description || null,
      status,
      created_by_admin_id: ctx.appUserId,
    });

    if (error) redirect("/dashboard/admin/associations?error=save_failed");
  }

  if (intent === "update") {
    if (!associationId) redirect("/dashboard/admin/associations?error=missing_association");

    const slug = await buildUniqueAssociationSlug(supabase, name, associationId);
    const { error } = await supabase
      .from("associations")
      .update({
        name,
        slug,
        description: description || null,
        profile: description || null,
        status,
      })
      .eq("id", associationId);

    if (error) redirect("/dashboard/admin/associations?error=save_failed");
  }

  revalidatePath("/dashboard/admin/associations");
  revalidatePath("/api/auth/register/associations");
  redirect("/dashboard/admin/associations?saved=1");
}

function formatAssociationDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value));
}

export default async function AdminAssociationManagementPage({
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
      .select("id,name,slug,description,profile,status,created_at")
      .order("created_at", { ascending: false })
      .returns<AssociationRow[]>(),
    supabase.from("msmes").select("association_id").not("association_id", "is", null).returns<AssociationMemberRow[]>(),
  ]);

  const rows = associations ?? [];
  const memberCounts = new Map<string, number>();
  (members ?? []).forEach((member) => {
    if (!member.association_id) return;
    memberCounts.set(member.association_id, (memberCounts.get(member.association_id) ?? 0) + 1);
  });

  const activeCount = rows.filter((association) => association.status === "active").length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Admin console</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Association Management</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Create and maintain MSME associations that appear in association-based registration.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-72">
          <article className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase text-slate-500">Total</p>
            <p className="text-2xl font-semibold">{rows.length}</p>
          </article>
          <article className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase text-slate-500">Active</p>
            <p className="text-2xl font-semibold">{activeCount}</p>
          </article>
        </div>
      </div>

      {params.saved && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Association changes saved.
        </p>
      )}
      {params.error === "name_required" && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Association name is required.</p>
      )}
      {params.error === "save_failed" && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Association could not be saved. Confirm the slug is unique and try again.
        </p>
      )}

      <form action={associationAdminAction} className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-[1.2fr_2fr_160px_140px]">
        <input type="hidden" name="intent" value="create" />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="association-name">
            Association name
          </label>
          <input id="association-name" name="name" required placeholder="e.g. Lagos Textile Producers Association" className="w-full rounded-lg border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="association-description">
            Description
          </label>
          <input id="association-description" name="description" placeholder="Optional short description" className="w-full rounded-lg border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="association-status">
            Status
          </label>
          <select id="association-status" name="status" defaultValue="active" className="w-full rounded-lg border px-3 py-2 text-sm">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button className="self-end rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">Create</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid grid-cols-[1.4fr_1fr_120px_120px] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 max-lg:hidden">
          <span>Association</span>
          <span>Description</span>
          <span>Status</span>
          <span>Members</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No associations have been created yet.</p>
        ) : (
          <div className="divide-y">
            {rows.map((association) => (
              <form key={association.id} action={associationAdminAction} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.4fr_1fr_120px_120px] lg:items-start">
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="association_id" value={association.id} />
                <div className="space-y-2">
                  <label className="sr-only" htmlFor={`name-${association.id}`}>
                    Association name
                  </label>
                  <input id={`name-${association.id}`} name="name" required defaultValue={association.name} className="w-full rounded-lg border px-3 py-2 text-sm font-medium" />
                  <p className="text-xs text-slate-500">
                    Slug: <span className="font-mono">{association.slug ?? slugifyAssociationName(association.name)}</span> · Created {formatAssociationDate(association.created_at)}
                  </p>
                </div>
                <div>
                  <label className="sr-only" htmlFor={`description-${association.id}`}>
                    Description
                  </label>
                  <textarea
                    id={`description-${association.id}`}
                    name="description"
                    defaultValue={association.description ?? association.profile ?? ""}
                    rows={2}
                    className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
                    placeholder="Optional description"
                  />
                </div>
                <select name="status" defaultValue={association.status ?? "active"} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <div className="flex flex-wrap items-center gap-2 lg:block">
                  <p className="min-w-16 text-sm font-semibold text-slate-900">{memberCounts.get(association.id) ?? 0}</p>
                  <div className="mt-0 flex gap-2 lg:mt-3">
                    <button className="rounded-lg border px-3 py-2 text-xs font-medium">Save</button>
                    <button
                      formAction={associationAdminAction}
                      name="action"
                      value="deactivate"
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              </form>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
