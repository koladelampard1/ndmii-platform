"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";

type Business = { id: string; msme_id: string; business_name: string; state: string; sector: string };
type Institution = { id: string; name: string };
type Request = { id: string; passport_access_status: string; relationship_status: string; institution: Institution | null; business: Business | null };
async function call(path: string, method = "GET", body?: object) {
  const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The action could not be completed.");
  return result;
}
export function InstitutionSharingConsole() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const [sharing, listing] = await Promise.all([call("/api/msme/institution-sharing"), call("/api/msme/institution-sharing/institutions")]);
    setBusinesses(sharing.businesses); setRequests(sharing.requests); setInstitutions(listing.institutions);
  }, []);
  useEffect(() => { void refresh().catch((cause) => setError(cause.message)); }, [refresh]);
  async function act(task: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await task(); await refresh(); setNotice(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-slate-900 sm:px-6">
    <Link href="/dashboard/msme" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800"><ArrowLeft size={16} /> Business dashboard</Link>
    <header className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-teal-950 p-7 text-white sm:p-10">
      <ShieldCheck className="text-teal-300" size={30} /><h1 className="mt-4 text-3xl font-black">Control who sees your business identity</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">A bank can prepare a relationship without access to your passport. You decide when to share the business name, DBIN ID, state, sector and verification status. You can withdraw that access at any time.</p>
    </header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-teal-50 p-4 text-teal-900">{notice}</p>}
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Share an existing DBIN business</h2>
      <p className="mt-1 text-sm text-slate-600">Choose a business registered through your account and an institution. The request begins with access pending.</p>
      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void act(async () => {
        await call("/api/msme/institution-sharing", "POST", { businessId, institutionId }); setBusinessId(""); setInstitutionId("");
      }, "Relationship request created. You can grant access below."); }}>
        <label className="text-sm font-semibold">Your business<select className="mt-1 block w-full rounded-xl border p-3" required value={businessId} onChange={(event) => setBusinessId(event.target.value)}><option value="">Choose business</option>{businesses.map((b) => <option key={b.id} value={b.id}>{b.business_name} · {b.msme_id}</option>)}</select></label>
        <label className="text-sm font-semibold">Institution<select className="mt-1 block w-full rounded-xl border p-3" required value={institutionId} onChange={(event) => setInstitutionId(event.target.value)}><option value="">Choose institution</option>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
        <button disabled={busy} className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Create request</button>
      </form>
    </section>
    <section className="space-y-3"><h2 className="text-xl font-bold">Institution requests</h2>
      {!requests.length && <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">No sharing requests yet.</p>}
      {requests.map((row) => <article key={row.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><p className="flex items-center gap-2 font-bold"><Building2 size={17} className="text-teal-700" />{row.institution?.name ?? "Institution"}</p>
          <p className="mt-1 text-sm text-slate-600">{row.business?.business_name ?? "Business"} · {row.business?.msme_id ?? ""}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-teal-800">Passport: {row.passport_access_status}</p></div>
        {row.relationship_status !== "closed" && <button disabled={busy} className="rounded-xl border border-teal-700 px-4 py-2 text-sm font-bold text-teal-900 disabled:opacity-50" onClick={() => {
          const action = row.passport_access_status === "granted" ? "revoke" : "grant";
          if (!window.confirm(action === "grant" ? `Share the business identity summary with ${row.institution?.name}? Confirm you are authorised to do so.` : `Withdraw ${row.institution?.name}'s access to the business identity summary?`)) return;
          void act(() => call(`/api/msme/institution-sharing/${row.id}`, "PATCH", { action, confirmed: true }), action === "grant" ? "Access granted." : "Access withdrawn.");
        }}>{row.passport_access_status === "granted" ? "Withdraw access" : "Share identity summary"}</button>}
      </article>)}
    </section>
  </main>;
}
