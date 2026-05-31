import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAssociationUploadWorkspace } from "@/lib/data/admin-associations";
import { processAssociationMemberUpload } from "@/lib/data/admin-association-members";
import { getCurrentUserContext } from "@/lib/auth/session";
import { AssociationMemberFileInput } from "./association-member-file-input";

const MAX_CSV_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"]);

function uploadErrorMessage(error: string) {
  const messages: Record<string, string> = {
    missing_association: "Select an association.",
    missing_csv: "Upload a CSV file or paste CSV content.",
    invalid_file_extension: "Upload a .csv file.",
    invalid_file_type: "The uploaded file type is not supported. Upload a CSV file.",
    file_too_large: "The CSV file exceeds the 2MB size limit.",
    process_failed: "The CSV could not be processed. Check the file format and try again.",
  };
  return messages[error] ?? error;
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

  const associationId = String(formData.get("association_id") ?? "");
  const csvFile = formData.get("csv_file");
  const pastedCsvContent = String(formData.get("csv_content") ?? "").trim();
  let csvContent = pastedCsvContent;
  let fileName = "association-members-pasted.csv";

  if (!associationId) redirect("/dashboard/admin/association-upload?error=missing_association");
  if (csvFile instanceof File && csvFile.size > 0) {
    fileName = csvFile.name.trim();
    if (!fileName.toLowerCase().endsWith(".csv")) redirect("/dashboard/admin/association-upload?error=invalid_file_extension");
    if (csvFile.type && !ACCEPTED_CSV_MIME_TYPES.has(csvFile.type.toLowerCase())) {
      redirect("/dashboard/admin/association-upload?error=invalid_file_type");
    }
    if (csvFile.size > MAX_CSV_FILE_SIZE) redirect("/dashboard/admin/association-upload?error=file_too_large");
    csvContent = (await csvFile.text()).trim();
  }
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
          Upload failed: {uploadErrorMessage(params.error)}
        </p>
      )}

      <form action={bulkImportAction} className="grid gap-3 rounded-xl border bg-white p-4">
        <div>
          <h2 className="font-semibold">Upload members for operational onboarding</h2>
          <p className="text-xs text-slate-600">
            Required columns: full_name, phone_number, business_name, trade_type, lga. Optional columns include
            whatsapp_number, email, association_membership_number, position_in_association, CAC/TIN registration
            fields, workshop_address, and years_of_experience.
          </p>
          <a href="/templates/association-members-upload.csv" download className="mt-2 inline-flex rounded border px-2 py-1 text-xs font-semibold">
            Download production CSV sample
          </a>
        </div>
        <select name="association_id" className="rounded border px-2 py-2 text-sm" required>
          <option value="">Select association</option>
          {workspace.associations.map((association) => (
            <option key={association.id} value={association.id}>{association.name} ({association.state ?? "state unavailable"})</option>
          ))}
        </select>
        <AssociationMemberFileInput />
        <label className="grid gap-1 text-sm font-semibold text-slate-800">
          Paste CSV manually (fallback)
          <textarea
            name="csv_content"
            className="min-h-32 rounded border px-2 py-2 font-mono text-xs font-normal"
            placeholder="Use this only when a CSV file is unavailable."
          />
        </label>
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
          {workspace.selectedImport && (
            <dl className="mt-3 grid gap-2 rounded-lg border bg-slate-50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-slate-500">Detected delimiter</dt><dd className="font-semibold">{workspace.selectedImport.delimiterLabel}</dd></div>
              <div><dt className="text-slate-500">Detected headers</dt><dd className="font-semibold">{workspace.selectedImport.headers.join(", ") || "None detected"}</dd></div>
              <div><dt className="text-slate-500">Row count</dt><dd className="font-semibold">{metricValue(workspace.selectedImport.totalRows)}</dd></div>
              <div><dt className="text-slate-500">Valid count</dt><dd className="font-semibold">{metricValue(workspace.selectedImport.successRows)}</dd></div>
              <div><dt className="text-slate-500">Failed count</dt><dd className="font-semibold">{metricValue(workspace.selectedImport.failedRows)}</dd></div>
              <div><dt className="text-slate-500">Duplicate count</dt><dd className="font-semibold">{metricValue(workspace.selectedImport.duplicateRows)}</dd></div>
              <div><dt className="text-slate-500">Operational records created</dt><dd className="font-semibold">{metricValue(workspace.selectedImport.createdRows)}</dd></div>
            </dl>
          )}
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
