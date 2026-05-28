import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAdminAssociationUploadWorkspace,
  writeAssociationActivityLog,
} from "@/lib/data/admin-associations";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function parseCsvRows(csv: string) {
  return csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

function metricValue(value: number | null) {
  return value == null ? "Unavailable" : value.toLocaleString();
}

function formatDate(value: string | null) {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function bulkImportAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const associationId = String(formData.get("association_id") ?? "");
  const csvContent = String(formData.get("csv_content") ?? "").trim();
  const fileName = String(formData.get("file_name") ?? "association-members.csv").trim() || "association-members.csv";

  if (!associationId) redirect("/dashboard/admin/association-upload?error=missing_association");
  if (!csvContent) redirect("/dashboard/admin/association-upload?error=missing_csv");

  const { data: association } = await supabase.from("associations").select("id").eq("id", associationId).maybeSingle();
  if (!association?.id) redirect("/dashboard/admin/association-upload?error=association_not_found");

  const rows = parseCsvRows(csvContent);
  const header = rows[0]?.map((cell) => cell.toLowerCase()) ?? [];
  const hasHeader = header.includes("member_name") || header.includes("business_name");
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const { data: importRecord, error: importError } = await supabase
    .from("association_member_imports")
    .insert({
      association_id: associationId,
      uploaded_by: ctx.appUserId,
      file_name: fileName,
      total_rows: dataRows.length,
      status: "processing",
      notes: hasHeader
        ? "Phase 1 import validation record. Header row detected. No MSMEs or members were created."
        : "Phase 1 import validation record. No header row detected. No MSMEs or members were created.",
    })
    .select("id")
    .maybeSingle();

  if (importError || !importRecord?.id) {
    console.error("[dashboard-admin-association-upload:create-import-failed]", {
      operation: "create_association_import_job",
      associationId,
      rowCount: dataRows.length,
      code: importError?.code ?? null,
      message: importError?.message ?? "Import creation returned no row.",
    });
    redirect("/dashboard/admin/association-upload?error=create_failed");
  }

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
    const { error: rowsError } = await supabase.from("association_member_import_rows").insert(rowPayload);
    if (rowsError) {
      console.error("[dashboard-admin-association-upload:rows-failed]", {
        operation: "create_association_import_rows",
        associationId,
        rowCount: rowPayload.length,
        code: rowsError.code ?? null,
        message: rowsError.message,
      });
    }
  }

  await supabase
    .from("association_member_imports")
    .update({
      success_rows: rowPayload.length - failed,
      failed_rows: failed,
      status: "completed",
      notes: `Phase 1 import validation only. Valid rows: ${rowPayload.length - failed}, failed rows: ${failed}. No MSMEs or association members were created.`,
    })
    .eq("id", importRecord.id);

  await writeAssociationActivityLog({
    supabase,
    actorUserId: ctx.appUserId,
    action: "association_import_job_created",
    associationId,
    metadata: {
      import_id: importRecord.id,
      row_count: dataRows.length,
      valid_rows: rowPayload.length - failed,
      failed_rows: failed,
    },
  });

  revalidatePath("/dashboard/admin/association-upload");
  revalidatePath("/dashboard/admin/associations");
  redirect(`/dashboard/admin/association-upload?saved=1&import=${importRecord.id}`);
}

export default async function AssociationBulkUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; import?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const workspace = await getAdminAssociationUploadWorkspace(params.import ?? null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Association Upload Validation</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Phase 1 records import jobs and validates rows for planning. It does not create MSMEs, activate accounts,
            approve members, or link operational memberships.
          </p>
        </div>
        <Link href="/dashboard/admin/associations" className="rounded border px-3 py-2 text-sm">Back to associations</Link>
      </div>

      {params.saved && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Import validation record saved.
        </p>
      )}
      {params.error && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Upload failed: {params.error}
        </p>
      )}

      <form action={bulkImportAction} className="grid gap-2 rounded-xl border bg-white p-4">
        <div>
          <h2 className="font-semibold">Record CSV validation job</h2>
          <p className="text-xs text-slate-600">
            Expected columns: member_name, email, phone, business_name, state, lga, sector. Only member_name and
            business_name are required in this Phase 1 validator.
          </p>
        </div>
        <select name="association_id" className="rounded border px-2 py-2 text-sm" required>
          <option value="">Select association</option>
          {workspace.associations.map((association) => (
            <option key={association.id} value={association.id}>{association.name} ({association.state ?? "state unavailable"})</option>
          ))}
        </select>
        <input name="file_name" defaultValue="association-members.csv" className="rounded border px-2 py-2 text-sm" />
        <textarea
          name="csv_content"
          required
          className="min-h-44 rounded border px-2 py-2 font-mono text-xs"
          placeholder="member_name,email,phone,business_name,state,lga,sector&#10;Ada Eze,ada@example.com,08030001111,Ada Home Decor,Lagos,Ikeja,Creative"
        />
        <button className="w-fit rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Record validation job</button>
      </form>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Recent import validation jobs</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Import</th>
                <th className="px-3 py-2">Association</th>
                <th className="px-3 py-2">Rows</th>
                <th className="px-3 py-2">Valid</th>
                <th className="px-3 py-2">Failed</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {workspace.imports.map((item) => (
                <tr key={item.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/admin/association-upload?import=${item.id}`} className="font-medium underline-offset-2 hover:underline">
                      {item.fileName ?? item.id}
                    </Link>
                    {item.notes && <p className="mt-1 max-w-xs text-xs text-slate-500">{item.notes}</p>}
                  </td>
                  <td className="px-3 py-2">{item.associationName ?? "Unavailable"}</td>
                  <td className="px-3 py-2">{metricValue(item.totalRows)}</td>
                  <td className="px-3 py-2">{metricValue(item.successRows)}</td>
                  <td className="px-3 py-2">{metricValue(item.failedRows)}</td>
                  <td className="px-3 py-2">{item.status ?? "Unavailable"}</td>
                  <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                </tr>
              ))}
              {workspace.imports.length === 0 && (
                <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={7}>No import validation jobs recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {params.import && (
        <article className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Selected import row preview</h2>
          <p className="text-xs text-slate-600">Limited to 50 rows. Email and phone values are masked.</p>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1">Row</th>
                  <th className="px-2 py-1">Business</th>
                  <th className="px-2 py-1">Member</th>
                  <th className="px-2 py-1">Email</th>
                  <th className="px-2 py-1">Phone</th>
                  <th className="px-2 py-1">State/Sector</th>
                  <th className="px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {workspace.selectedImportRows.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-2 py-1">{row.rowNumber ?? "n/a"}</td>
                    <td className="px-2 py-1">{row.businessName ?? "Missing"}</td>
                    <td className="px-2 py-1">{row.memberName ?? "Missing"}</td>
                    <td className="px-2 py-1">{row.email ?? "Unavailable"}</td>
                    <td className="px-2 py-1">{row.phone ?? "Unavailable"}</td>
                    <td className="px-2 py-1">{row.state ?? "n/a"} / {row.sector ?? "n/a"}</td>
                    <td className="px-2 py-1">{row.status ?? "Unavailable"}{row.errorMessage ? `: ${row.errorMessage}` : ""}</td>
                  </tr>
                ))}
                {workspace.selectedImportRows.length === 0 && (
                  <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={7}>No row preview available for this import.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      <details className="rounded-xl border bg-white p-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Source availability</summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {Object.entries(workspace.sources).map(([source, state]) => (
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
