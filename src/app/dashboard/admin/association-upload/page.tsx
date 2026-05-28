import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAssociationUploadWorkspace } from "@/lib/data/admin-associations";
import { processAssociationMemberUpload } from "@/lib/data/admin-association-members";
import { getCurrentUserContext } from "@/lib/auth/session";

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

  const associationId = String(formData.get("association_id") ?? "");
  const csvContent = String(formData.get("csv_content") ?? "").trim();
  const fileName = String(formData.get("file_name") ?? "association-members.csv").trim() || "association-members.csv";

  if (!associationId) redirect("/dashboard/admin/association-upload?error=missing_association");
  if (!csvContent) redirect("/dashboard/admin/association-upload?error=missing_csv");

  let result: Awaited<ReturnType<typeof processAssociationMemberUpload>>;
  try {
    result = await processAssociationMemberUpload({
      associationId,
      actorUserId: ctx.appUserId,
      fileName,
      csvContent,
    });
  } catch (error) {
    console.info("[dashboard-admin-association-upload:process-failed]", {
      operation: "process_association_member_upload",
      associationId,
      importId: null,
      rowCount: 0,
      createdCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      message: error instanceof Error ? error.message : "Upload processing failed.",
    });
    redirect("/dashboard/admin/association-upload?error=process_failed");
  }

  revalidatePath("/dashboard/admin/association-upload");
  revalidatePath("/dashboard/admin/associations");
  revalidatePath("/dashboard/admin/association-members");
  redirect(`/dashboard/admin/association-upload?saved=1&import=${result.importId}`);
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
            Uploads now create operational member records for onboarding queues. Members remain pending activation or
            duplicate review; no MSMEs, approvals, credentials, NIN, or BVN records are created automatically.
          </p>
        </div>
        <Link href="/dashboard/admin/associations" className="rounded border px-3 py-2 text-sm">Back to associations</Link>
      </div>

      {params.saved && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Member import processed. Operational records are pending activation or duplicate review.
        </p>
      )}
      {params.error && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Upload failed: {params.error}
        </p>
      )}

      <form action={bulkImportAction} className="grid gap-2 rounded-xl border bg-white p-4">
        <div>
          <h2 className="font-semibold">Upload members for operational onboarding</h2>
          <p className="text-xs text-slate-600">
            Required columns: full_name, phone_number, business_name, trade_type, lga. Optional columns include
            whatsapp_number, email, association_membership_number, position_in_association, CAC/TIN registration
            fields, workshop_address, and years_of_experience.
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
          placeholder="full_name,phone_number,business_name,trade_type,lga,email,cac_registered,cac_number,tin_registered,tin_number&#10;Ada Eze,08030001111,Ada Home Decor,Furniture,Ikeja,ada@example.com,no,,no,"
        />
        <button className="w-fit rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Process member upload</button>
      </form>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Recent member import jobs</h2>
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
                <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={7}>No member import jobs recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {params.import && (
        <article className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Selected import row preview</h2>
          <p className="text-xs text-slate-600">Limited to 50 rows. Email and phone values are masked. Duplicate rows need human review.</p>
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
                    <td className="px-2 py-1">
                      {row.status ?? "Unavailable"}
                      {row.errorMessage ? `: ${row.errorMessage}` : ""}
                      {row.duplicateSignal ? ` • duplicate: ${row.duplicateReasons.join(", ") || "signal"}` : ""}
                    </td>
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
