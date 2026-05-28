import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAdminAssociationsDirectory,
  parseAssociationDirectoryFilters,
  writeAssociationActivityLog,
} from "@/lib/data/admin-associations";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SearchParams = {
  q?: string;
  state?: string;
  sector?: string;
  status?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
  saved?: string;
  id?: string;
  error?: string;
};

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeSlug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "association"
  );
}

function redirectWithAssociationError(message: string): never {
  redirect(`/dashboard/admin/associations?error=${encodeURIComponent(message)}`);
}

function metricValue(value: number | null) {
  return value == null ? "Unavailable" : value.toLocaleString();
}

function formatDate(value: string | null) {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value));
}

function buildPageHref(params: SearchParams, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || ["saved", "id", "error"].includes(key)) continue;
    query.set(key, value);
  }
  query.set("page", String(page));
  return `/dashboard/admin/associations?${query.toString()}`;
}

async function generateUniqueAssociationSlug(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  name: string,
) {
  const baseSlug = normalizeSlug(name);
  const { data: existingRows, error } = await supabase
    .from("associations")
    .select("slug")
    .ilike("slug", `${baseSlug}%`);

  if (error) {
    throw new Error(error.message || "Unable to check existing association slugs.");
  }

  const existingSlugs = new Set((existingRows ?? []).map((row) => row.slug).filter(Boolean));
  if (!existingSlugs.has(baseSlug)) return baseSlug;

  let suffix = 2;
  let candidate = `${baseSlug}-${suffix}`;
  while (existingSlugs.has(candidate)) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
}

async function associationAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const kind = String(formData.get("kind"));
  const associationId = String(formData.get("association_id") ?? "");

  if (kind === "create") {
    const name = formValue(formData, "name");
    const sector = formValue(formData, "sector_focus");
    const state = formValue(formData, "state");
    const lgaCoverage = formValue(formData, "lga_coverage");
    const contactEmail = formValue(formData, "contact_email");
    const contactPhone = formValue(formData, "contact_phone");
    const status = formValue(formData, "status") || "active";
    const profile = formValue(formData, "profile");

    if (!name || !sector || !state) {
      redirectWithAssociationError("Association name, sector, and state are required.");
    }

    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      redirectWithAssociationError("Contact email format is invalid.");
    }

    const slug = await generateUniqueAssociationSlug(supabase, name);
    const { data: duplicateName, error: duplicateError } = await supabase
      .from("associations")
      .select("id")
      .ilike("name", name)
      .limit(1);

    if (duplicateError) {
      console.error("[dashboard-admin-associations:create:duplicate-check-failed]", {
        operation: "create_association",
        code: duplicateError.code ?? null,
        message: duplicateError.message,
      });
      redirectWithAssociationError("Unable to validate duplicate association names.");
    }

    if ((duplicateName ?? []).length > 0) {
      redirectWithAssociationError("An association with this name already exists.");
    }

    const payload = {
      name,
      status,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      description: profile || null,
      category: sector,
      location: state,
      slug,
      created_by_admin_id: ctx.appUserId || null,
      updated_at: new Date().toISOString(),
      sector,
      state,
      lga_coverage: lgaCoverage || null,
      profile: profile || null,
    };

    const { data: insertedAssociation, error } = await supabase
      .from("associations")
      .insert(payload)
      .select("id")
      .single();

    if (error || !insertedAssociation?.id) {
      console.error("[dashboard-admin-associations:create-failed]", {
        operation: "create_association",
        code: error?.code ?? null,
        message: error?.message ?? "Association creation returned no row.",
      });
      redirectWithAssociationError(error?.message || "Association creation failed.");
    }

    const insertedAssociationId = insertedAssociation.id;
    await writeAssociationActivityLog({
      supabase,
      actorUserId: ctx.appUserId,
      action: "association_created",
      associationId: insertedAssociationId,
      metadata: {
        new_status: status,
        source_workspace: "dashboard_admin_associations",
      },
    });

    redirect(`/dashboard/admin/associations?saved=created&id=${insertedAssociationId}`);
  }

  if (kind === "update") {
    const { data: current } = await supabase
      .from("associations")
      .select("id,status")
      .eq("id", associationId)
      .maybeSingle();

    if (!current?.id) redirectWithAssociationError("Association not found.");

    const previousStatus = current.status ?? null;
    const nextStatus = formValue(formData, "status") || "active";
    const { error } = await supabase
      .from("associations")
      .update({
        name: formValue(formData, "name"),
        sector: formValue(formData, "sector_focus") || "General",
        state: formValue(formData, "state"),
        lga_coverage: formValue(formData, "lga_coverage"),
        profile: formValue(formData, "profile"),
        contact_email: formValue(formData, "contact_email") || null,
        contact_phone: formValue(formData, "contact_phone") || null,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", associationId);

    if (error) {
      console.error("[dashboard-admin-associations:update-failed]", {
        operation: "update_association",
        associationId,
        code: error.code ?? null,
        message: error.message,
      });
      redirectWithAssociationError(error.message || "Association update failed.");
    }

    await writeAssociationActivityLog({
      supabase,
      actorUserId: ctx.appUserId,
      action: "association_updated",
      associationId,
      metadata: {
        previous_status: previousStatus,
        new_status: nextStatus,
      },
    });
  }

  redirect("/dashboard/admin/associations?saved=updated");
}

export default async function AssociationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const directory = await getAdminAssociationsDirectory(params);
  const parsedFilters = parseAssociationDirectoryFilters(params);
  const hasPrevious = directory.pagination.page > 1;
  const hasNext = directory.pagination.totalPages == null || directory.pagination.page < directory.pagination.totalPages;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin Association Management</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Phase 1 foundation view. Bulk uploads are recorded and row-validated only; they do not create MSMEs,
            activate members, or approve association membership.
          </p>
        </div>
        <Link href="/dashboard/admin/association-upload" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Record/import-validate upload
        </Link>
      </div>

      {params.saved && (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
          Association {params.saved === "created" ? "created" : "changes saved"}.
        </p>
      )}
      {params.error && (
        <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
          Association save failed: {params.error}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Associations</p><p className="text-2xl font-semibold">{metricValue(directory.kpis.totalAssociations)}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Active</p><p className="text-2xl font-semibold">{metricValue(directory.kpis.activeAssociations)}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Linked members</p><p className="text-2xl font-semibold">{metricValue(directory.kpis.totalLinkedMembers)}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Pending requests</p><p className="text-2xl font-semibold">{metricValue(directory.kpis.pendingMembershipRequests)}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Linked MSMEs</p><p className="text-2xl font-semibold">{metricValue(directory.kpis.msmesLinkedToAssociations)}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Import jobs</p><p className="text-2xl font-semibold">{metricValue(directory.kpis.importJobsRecorded)}</p></article>
      </div>

      <details className="rounded-xl border bg-white p-4 text-sm text-slate-700">
        <summary className="cursor-pointer font-semibold">Phase 1 canonical read strategy</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {directory.canonicalStrategy.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </details>

      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
        <input name="q" defaultValue={directory.filters.q} placeholder="Search name/profile" className="rounded border px-2 py-2 text-sm" />
        <input name="state" defaultValue={directory.filters.state} placeholder="State" className="rounded border px-2 py-2 text-sm" />
        <input name="sector" defaultValue={directory.filters.sector} placeholder="Sector" className="rounded border px-2 py-2 text-sm" />
        <input name="status" defaultValue={directory.filters.status} placeholder="Status" className="rounded border px-2 py-2 text-sm" />
        <select name="sort" defaultValue={directory.filters.sort} className="rounded border px-2 py-2 text-sm">
          <option value="created_desc">Newest</option>
          <option value="created_asc">Oldest</option>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
          <option value="state_asc">State</option>
          <option value="status_asc">Status</option>
        </select>
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply</button>
      </form>

      <form action={associationAction} className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
        <div className="md:col-span-4">
          <h2 className="font-semibold">Create association foundation record</h2>
          <p className="text-xs text-slate-600">Creates the association profile only. Officer assignment and verification workflow are pending.</p>
        </div>
        <input type="hidden" name="kind" value="create" />
        <input name="name" required placeholder="Association name *" className="rounded border px-2 py-2 text-sm" />
        <input name="sector_focus" required placeholder="Sector focus *" className="rounded border px-2 py-2 text-sm" />
        <input name="state" required placeholder="State *" className="rounded border px-2 py-2 text-sm" />
        <input name="lga_coverage" placeholder="LGA coverage" className="rounded border px-2 py-2 text-sm" />
        <input name="contact_email" type="email" placeholder="Contact email" className="rounded border px-2 py-2 text-sm" />
        <input name="contact_phone" placeholder="Contact phone" className="rounded border px-2 py-2 text-sm" />
        <select name="status" defaultValue="active" className="rounded border px-2 py-2 text-sm">
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="under review">under review</option>
        </select>
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-800">
          Officer assignment workflow pending.
        </p>
        <input name="profile" placeholder="Association summary" className="rounded border px-2 py-2 text-sm md:col-span-3" />
        <button className="rounded bg-emerald-800 px-3 py-2 text-sm text-white">Create association</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Association</th>
              <th className="px-3 py-2">Coverage</th>
              <th className="px-3 py-2">Officer/contact</th>
              <th className="px-3 py-2">Counts</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Members</th>
            </tr>
          </thead>
          <tbody>
            {directory.rows.map((association) => (
              <tr key={association.id} className="border-t align-top">
                <td className="px-3 py-3">
                  <p className="font-semibold">{association.name}</p>
                  <p className="text-xs text-slate-500">{association.sector ?? "Sector unavailable"} • {association.status ?? "Status unavailable"}</p>
                </td>
                <td className="px-3 py-3">
                  <p>{association.state ?? "State unavailable"}</p>
                  <p className="text-xs text-slate-500">LGA: {association.lgaCoverage ?? "Unavailable"}</p>
                </td>
                <td className="px-3 py-3">
                  <p>{association.officerName ?? "Officer not assigned"}</p>
                  <p className="text-xs text-slate-500">{association.officerEmail ?? association.contactEmail ?? "Contact unavailable"}</p>
                  {association.contactPhone && <p className="text-xs text-slate-500">{association.contactPhone}</p>}
                </td>
                <td className="px-3 py-3 text-xs text-slate-700">
                  <p>Members: {metricValue(association.linkedMembersCount)}</p>
                  <p>Pending: {metricValue(association.pendingMembershipCount)}</p>
                  <p>MSMEs: {metricValue(association.msmesLinkedCount)}</p>
                  <p>Imports: {metricValue(association.importJobsCount)}</p>
                </td>
                <td className="px-3 py-3">{formatDate(association.createdAt)}</td>
                <td className="px-3 py-3">
                  <Link href={`/dashboard/admin/association-members?association=${association.id}`} className="rounded border px-3 py-1 text-xs">
                    View data snapshot
                  </Link>
                </td>
              </tr>
            ))}
            {directory.rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No associations found for the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">
          Page {directory.pagination.page} of {directory.pagination.totalPages ?? "Unavailable"} • {directory.pagination.total == null ? "Unavailable total" : `${directory.pagination.total.toLocaleString()} total`}
        </p>
        <div className="flex gap-2">
          <Link
            aria-disabled={!hasPrevious}
            className={`rounded border px-3 py-1 ${hasPrevious ? "" : "pointer-events-none opacity-50"}`}
            href={buildPageHref(params, Math.max(1, parsedFilters.page - 1))}
          >
            Previous
          </Link>
          <Link
            aria-disabled={!hasNext}
            className={`rounded border px-3 py-1 ${hasNext ? "" : "pointer-events-none opacity-50"}`}
            href={buildPageHref(params, parsedFilters.page + 1)}
          >
            Next
          </Link>
        </div>
      </div>

      <details className="rounded-xl border bg-white p-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Source availability</summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {Object.entries(directory.sources).map(([source, state]) => (
            <p key={source}>
              <span className={state.available ? "text-emerald-700" : "text-rose-700"}>{state.available ? "Available" : "Unavailable"}</span>
              {" "}{source}{state.message ? `: ${state.message}` : ""}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
