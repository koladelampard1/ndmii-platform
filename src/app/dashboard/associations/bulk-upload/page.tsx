import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function parseCsvRows(csv: string) {
  return csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

async function bulkImportAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const associationId = String(formData.get("association_id") ?? "");
  const csvContent = String(formData.get("csv_content") ?? "").trim();
  const fileName = String(formData.get("file_name") ?? "association-members.csv");

  if (!csvContent) redirect("/dashboard/associations/bulk-upload?error=missing_csv");

  if (ctx.role === "association_officer" && associationId !== ctx.linkedAssociationId) redirect("/access-denied");

  const rows = parseCsvRows(csvContent);
  const header = rows[0]?.map((cell) => cell.toLowerCase()) ?? [];
  const hasHeader = header.includes("member_name") || header.includes("business_name");
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const { data: importRecord } = await supabase
    .from("association_member_imports")
    .insert({
      association_id: associationId,
      uploaded_by: ctx.appUserId,
      file_name: fileName,
      total_rows: dataRows.length,
      status: "processing",
      notes: hasHeader ? "Header row detected" : "No header row detected",
    })
    .select("id")
    .maybeSingle();

  if (!importRecord?.id) redirect("/dashboard/associations/bulk-upload?error=create_failed");

  let failed = 0;
  const rowPayload = dataRows.map((cols, index) => {
    const memberName = cols[0] ?? "";
    const email = cols[1] ?? "";
    const phone = cols[2] ?? "";
    const businessName = cols[3] ?? "";
    const state = cols[4] ?? "";
    const lga = cols[5] ?? "";
    const sector = cols[6] ?? "";

    const status = memberName && businessName ? "imported" : "failed";
    if (status === "failed") failed += 1;

    return {
      import_id: importRecord.id,
      row_number: index + 1,
      member_name: memberName || null,
      email: email || null,
      phone: phone || null,
      business_name: businessName || null,
      state: state || null,
      lga: lga || null,
      sector: sector || null,
      status,
      error_message: status === "failed" ? "member_name and business_name are required." : null,
    };
  });

  if (rowPayload.length) {
    await supabase.from("association_member_import_rows").insert(rowPayload);
  }

  await supabase
    .from("association_member_imports")
    .update({
      success_rows: rowPayload.length - failed,
      failed_rows: failed,
      status: failed > 0 ? "completed" : "completed",
    })
    .eq("id", importRecord.id);

  revalidatePath("/dashboard/associations/bulk-upload");
  redirect(`/dashboard/associations/bulk-upload?saved=1&import=${importRecord.id}`);
}

export default async function AssociationBulkUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; import?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();

  let associationQuery = supabase.from("associations").select("id,name,state,sector").order("name");
  if (ctx.role === "association_officer") {
    associationQuery = associationQuery.eq("id", ctx.linkedAssociationId ?? "");
  }

  const [{ data: associations }, { data: imports }] = await Promise.all([
    associationQuery,
    supabase
      .from("association_member_imports")
      .select("id,association_id,file_name,total_rows,success_rows,failed_rows,status,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Association bulk onboarding</h1>
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Import recorded successfully.</p>}
      {params.error && <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{params.error}</p>}

      <form action={bulkImportAction} className="grid gap-2 rounded-xl border bg-white p-4">
        <select name="association_id" className="rounded border px-2 py-2 text-sm" required>
          <option value="">Select association</option>
          {(associations ?? []).map((association) => (
            <option key={association.id} value={association.id}>{association.name} ({association.state})</option>
          ))}
        </select>
        <input name="file_name" defaultValue="association-members.csv" className="rounded border px-2 py-2 text-sm" />
        <textarea
          name="csv_content"
          required
          className="min-h-44 rounded border px-2 py-2 font-mono text-xs"
          placeholder="member_name,email,phone,business_name,state,lga,sector&#10;Ada Eze,ada@example.com,08030001111,Ada Home Decor,Lagos,Ikeja,Creative"
        />
        <button className="w-fit rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Upload CSV foundation</button>
      </form>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Recent imports</h2>
        <div className="mt-2 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Import</th><th className="px-3 py-2">Rows</th><th className="px-3 py-2">Success</th><th className="px-3 py-2">Failed</th><th className="px-3 py-2">Status</th></tr></thead>
            <tbody>
              {(imports ?? []).map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{item.file_name ?? item.id}</td>
                  <td className="px-3 py-2">{item.total_rows}</td>
                  <td className="px-3 py-2">{item.success_rows}</td>
                  <td className="px-3 py-2">{item.failed_rows}</td>
                  <td className="px-3 py-2">{item.status}</td>
                </tr>
              ))}
              {(!imports || imports.length === 0) && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>No imports yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
