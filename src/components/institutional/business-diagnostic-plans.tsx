"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
type Plan = { id: string; institution_id: string; engagement_id: string; questions: {id:string;label:string}[];
  answers: Record<string,string>; findings: string; actions: {title:string;owner:string;dueDate:string}[];
  status: string; review_reason: string|null; next_action: string|null };
export function BusinessDiagnosticPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [reasons, setReasons] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/msme/diagnostic-plans", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Plans unavailable.");
    setPlans(data.plans);
  }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  async function act(id: string, action: "agree" | "request_changes") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/msme/diagnostic-plans/${id}`, { method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason: reasons[id] }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed.");
      await load(); setNotice(action === "agree" ? "Plan agreed. The agent can submit it for review." : "Changes requested from the agent.");
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 text-slate-900 sm:px-6">
    <Link href="/dashboard/msme" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800"><ArrowLeft size={17}/> Business dashboard</Link>
    <header className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-teal-950 p-8 text-white"><ClipboardCheck className="text-teal-300" size={32}/><h1 className="mt-4 text-3xl font-black">Your business development plans</h1><p className="mt-2 text-sm text-slate-200">Review the assessment and proposed actions before the agent submits the case.</p></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}{notice && <p role="status" className="rounded-xl bg-teal-50 p-4 text-teal-900">{notice}</p>}
    {!plans.length && <p className="rounded-2xl border bg-white p-6 text-slate-600">No shared development plans are available yet.</p>}
    {plans.map(plan => <article key={plan.id} className="rounded-3xl border bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-teal-700">{plan.status.replaceAll("_"," ")}</p><h2 className="mt-1 text-xl font-bold">Development plan · {plan.engagement_id.slice(0,8)}</h2>
      <div className="mt-5 space-y-3">{plan.questions.map(q => <div key={q.id} className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{q.label}</strong><p className="mt-1 whitespace-pre-wrap">{plan.answers[q.id] ?? "—"}</p></div>)}<div className="text-sm"><h3 className="font-bold">Findings</h3><p className="whitespace-pre-wrap">{plan.findings}</p></div><div><h3 className="font-bold">Agreed actions</h3><ul className="mt-2 space-y-2">{plan.actions.map((a,i) => <li key={i} className="rounded-xl border p-3 text-sm"><strong>{a.title}</strong><span className="ml-2 text-slate-600">{a.owner} · due {a.dueDate}</span></li>)}</ul></div></div>
      {plan.status === "awaiting_agreement" && <div className="mt-6 space-y-3 border-t pt-5"><p className="text-sm text-slate-600">Agree if the record reflects your discussion, or explain what the agent should correct.</p><textarea aria-label="Changes requested" placeholder="Describe corrections needed" className="w-full rounded-xl border p-3 text-sm" value={reasons[plan.id] ?? ""} onChange={e => setReasons({ ...reasons, [plan.id]: e.target.value })}/><div className="flex flex-wrap gap-2"><button disabled={busy} className="rounded-xl bg-teal-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={() => void act(plan.id,"agree")}>Agree to plan</button><button disabled={busy} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50" onClick={() => void act(plan.id,"request_changes")}>Request changes</button></div></div>}
      {plan.review_reason && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Feedback: {plan.review_reason} · {plan.next_action}</p>}
    </article>)}
  </main>;
}
