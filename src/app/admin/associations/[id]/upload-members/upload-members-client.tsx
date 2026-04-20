"use client";

import { useMemo, useState } from "react";
import { BULK_UPLOAD_COLUMNS, parseCsvContent, toCsvDownload, validateUploadRows } from "@/lib/associations/bulk-upload";

type Props = {
  categories: string[];
  locations: string[];
  processUpload: (formData: FormData) => Promise<void>;
};

export function UploadMembersClient({ categories, locations, processUpload }: Props) {
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState("association-members.csv");

  const parsed = useMemo(() => parseCsvContent(csvContent), [csvContent]);
  const validated = useMemo(
    () => validateUploadRows({ rows: parsed.rows, categories, locations }),
    [parsed.rows, categories, locations],
  );

  const headersOk = useMemo(
    () => BULK_UPLOAD_COLUMNS.every((column) => parsed.headers.includes(column)),
    [parsed.headers],
  );

  const invalidReport = useMemo(
    () =>
      toCsvDownload(
        validated.invalidRows.map((row) => ({
          row_number: row.rowNumber,
          errors: row.errors.join(" | "),
          ...row.values,
        })),
      ),
    [validated.invalidRows],
  );

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    file.text().then(setCsvContent);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Upload CSV or Excel-exported CSV</h2>
        <p className="text-xs text-slate-600">Required template columns: {BULK_UPLOAD_COLUMNS.join(", ")}.</p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="mt-3 text-sm" />
      </div>

      {!headersOk && parsed.headers.length > 0 && (
        <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">Template mismatch detected. Download and reuse the official template.</p>
      )}

      {parsed.rows.length > 0 && (
        <article className="space-y-3 rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Preview & validation</h3>
            <div className="text-xs text-slate-600">
              Valid rows: <strong>{validated.validRows.length}</strong> • Invalid rows: <strong>{validated.invalidRows.length}</strong>
            </div>
          </div>

          {validated.invalidRows.length > 0 && invalidReport && (
            <a
              download="association-upload-errors.csv"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(invalidReport)}`}
              className="inline-flex rounded border px-2 py-1 text-xs"
            >
              Download error report
            </a>
          )}

          <div className="max-h-72 overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1">Row</th>
                  <th className="px-2 py-1">Business</th>
                  <th className="px-2 py-1">Owner</th>
                  <th className="px-2 py-1">Email</th>
                  <th className="px-2 py-1">Phone</th>
                  <th className="px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {validated.allRows.map((row) => (
                  <tr key={row.rowNumber} className="border-t align-top">
                    <td className="px-2 py-1">{row.rowNumber}</td>
                    <td className="px-2 py-1">{row.values.business_name}</td>
                    <td className="px-2 py-1">{row.values.owner_full_name}</td>
                    <td className="px-2 py-1">{row.values.email}</td>
                    <td className="px-2 py-1">{row.values.phone}</td>
                    <td className="px-2 py-1">
                      {row.errors.length === 0 ? (
                        <span className="rounded bg-emerald-100 px-1 py-0.5 text-emerald-700">Valid</span>
                      ) : (
                        <div className="space-y-1">
                          <span className="rounded bg-rose-100 px-1 py-0.5 text-rose-700">Invalid</span>
                          {row.errors.map((error) => (
                            <p key={error} className="text-rose-700">• {error}</p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={processUpload}>
            <input type="hidden" name="file_name" value={fileName} />
            <input type="hidden" name="valid_rows_json" value={JSON.stringify(validated.validRows.map((row) => row.values))} />
            <button
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!headersOk || validated.validRows.length === 0}
            >
              Proceed with valid rows only ({validated.validRows.length})
            </button>
          </form>
        </article>
      )}
    </div>
  );
}
