import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UploadMembersClient } from "./upload-members-client";
import { getCurrentUserContext } from "@/lib/auth/session";
import { processAssociationBulkRows } from "@/lib/associations/onboarding";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminAssociationUploadMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; total?: string; invited?: string; failed?: string; already?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const [{ data: association }, { data: categories }, { data: locations }] = await Promise.all([
    supabase.from("associations").select("id,name").eq("id", id).maybeSingle(),
    supabase.from("msmes").select("sector"),
    supabase.from("msmes").select("state"),
  ]);

  if (!association) {
    return <main className="rounded border bg-white p-6">Association not found.</main>;
  }

  async function processUploadAction(formData: FormData) {
    "use server";
    const actionCtx = await getCurrentUserContext();
    if (actionCtx.role !== "admin") redirect("/access-denied");

    const validRowsRaw = String(formData.get("valid_rows_json") ?? "[]");
    const fileName = String(formData.get("file_name") ?? "association-members.csv");

    let rows: Array<Record<string, string>> = [];
    try {
      rows = JSON.parse(validRowsRaw) as Array<Record<string, string>>;
    } catch {
      redirect(`/admin/associations/${id}/upload-members?error=invalid_payload`);
    }

    const actionSupabase = await createServerSupabaseClient();

    const result = await processAssociationBulkRows({
      associationId: id,
      uploadedBy: actionCtx.appUserId,
      rows: rows.map((row) => ({
        business_name: String(row.business_name ?? ""),
        owner_full_name: String(row.owner_full_name ?? ""),
        phone: String(row.phone ?? ""),
        email: String(row.email ?? ""),
        category: String(row.category ?? ""),
        subcategory: String(row.subcategory ?? ""),
        location: String(row.location ?? ""),
        association_member_id: String(row.association_member_id ?? ""),
        cac_number: String(row.cac_number ?? ""),
        tin: String(row.tin ?? ""),
        address: String(row.address ?? ""),
      })),
    });

    await actionSupabase.from("association_member_imports").insert({
      association_id: id,
      uploaded_by: actionCtx.appUserId,
      file_name: fileName,
      total_rows: result.total,
      success_rows: result.invited + result.alreadyExists,
      failed_rows: result.failed,
      status: "completed",
      notes: `Invited: ${result.invited}, already exists: ${result.alreadyExists}, failed: ${result.failed}`,
    });

    revalidatePath(`/admin/associations/${id}`);
    revalidatePath(`/admin/associations/${id}/members`);
    revalidatePath("/admin/associations");
    redirect(`/admin/associations/${id}/upload-members?saved=1&total=${result.total}&invited=${result.invited}&failed=${result.failed}&already=${result.alreadyExists}`);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Upload members: {association.name}</h1>
        <div className="flex gap-2 text-xs">
          <a href="/api/admin/associations/template?format=csv" className="rounded border px-2 py-1">Download MSME Upload Template</a>
          <Link href={`/admin/associations/${id}/members`} className="rounded border px-2 py-1">View members</Link>
          <Link href={`/admin/associations/${id}`} className="rounded border px-2 py-1">Back to association</Link>
        </div>
      </div>

      {query.saved && (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
          Bulk upload processed. Total: {query.total} • Invited: {query.invited} • Failed: {query.failed} • Already exists: {query.already}
        </p>
      )}

      <UploadMembersClient
        categories={[...new Set((categories ?? []).map((item) => item.sector).filter(Boolean))] as string[]}
        locations={[...new Set((locations ?? []).map((item) => item.state).filter(Boolean))] as string[]}
        processUpload={processUploadAction}
      />
    </section>
  );
}
