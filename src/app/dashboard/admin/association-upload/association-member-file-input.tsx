"use client";

import { useState } from "react";

export function AssociationMemberFileInput() {
  const [selectedFileName, setSelectedFileName] = useState("");

  return (
    <div className="rounded-lg border border-dashed bg-slate-50 p-3">
      <label className="block text-sm font-semibold text-slate-800" htmlFor="association-member-csv">
        Upload CSV file
      </label>
      <p className="mt-1 text-xs text-slate-600">CSV files only. Maximum file size: 2MB.</p>
      <input
        id="association-member-csv"
        name="csv_file"
        type="file"
        accept=".csv,text/csv"
        className="mt-2 block text-sm"
        onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? "")}
      />
      <p className="mt-2 text-xs text-slate-600">
        Selected file: <span className="font-semibold text-slate-800">{selectedFileName || "None selected"}</span>
      </p>
    </div>
  );
}
