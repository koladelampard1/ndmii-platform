"use client";

import { useActionState } from "react";
import { regenerateAssociationMemberTemporaryPin, type TemporaryAccessActionState } from "./actions";

const initialState: TemporaryAccessActionState = { ok: false, message: "" };

function accessCsv(rows: NonNullable<TemporaryAccessActionState["accessDetails"]>) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return ["member_name,phone,email,business_name,temporary_pin,expiry_date", ...rows.map((row) => [row.memberName, row.phone, row.email, row.businessName, row.temporaryPin, row.expiresAt].map(escape).join(","))].join("\r\n");
}

export function TemporaryAccessActions({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(regenerateAssociationMemberTemporaryPin, initialState);
  function download() {
    if (!state.accessDetails?.length) return;
    const url = URL.createObjectURL(new Blob([accessCsv(state.accessDetails)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "association-member-one-time-access-details.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return <div className="space-y-2"><form action={action}><input type="hidden" name="member_id" value={memberId} /><button disabled={pending} className="w-full rounded bg-slate-950 px-3 py-2 text-sm font-black text-white disabled:opacity-50">{pending ? "Generating..." : "Regenerate temporary PIN"}</button></form>{state.message && <p className={`rounded p-2 text-xs font-bold ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{state.message}</p>}{state.accessDetails?.length ? <button type="button" onClick={download} className="w-full rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800">Download one-time access details</button> : null}</div>;
}
