"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardList, FileUp, RefreshCw } from "lucide-react";

type Question = { id: string; label: string };
type Action = { title: string; owner: "agent" | "business" | "institution"; dueDate: string };
type Template = { id: string; name: string; version: number; questions: Question[] };
type Case = { id: string; engagement_id: string; agent_member_id: string; questions: Question[]; answers: Record<string,string>;
  findings: string; actions: Action[]; status: string; review_reason: string | null; next_action: string | null; updated_at: string };
type Activity = { id: string; kind: string; summary: string; occurred_at: string };
type Evidence = { id: string; file_name: string; activity_id: string | null };
type Assignment = { engagement_id: string; agent_member_id: string };
type Available = { engagementId: string; businessName: string };
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";
const primary = "rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
const secondary = "rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-50";
async function api(path: string, method = "GET", body?: object | FormData) {
  const form = body instanceof FormData;
  const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store",
    headers: body && !form ? { "Content-Type": "application/json" } : undefined,
    body: body ? form ? body : JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
export function DiagnosticWorkbench({ institutionId, institutionName, manager }: { institutionId: string; institutionName: string; manager: boolean }) {
  const base = `/api/institutions/${institutionId}`;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [record, setRecord] = useState<Case | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [engagementId, setEngagementId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [questionLines, setQuestionLines] = useState("Business registration and formalisation\nHow are sales and expenses recorded?\nWhat support is needed before finance?");
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [findings, setFindings] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [activityKind, setActivityKind] = useState("mentorship");
  const [activitySummary, setActivitySummary] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const [t, a, c] = await Promise.all([api(`${base}/diagnostic-templates`), api(`${base}/assignments`), api(`${base}/diagnostics`)]);
    setTemplates(t.templates ?? []); setAssignments(a.assignments ?? []); setCases(c.cases ?? []); setAvailable(c.available ?? []);
  }, [base]);
  const loadCase = useCallback(async (id: string) => {
    const detail = await api(`${base}/diagnostics/${id}`);
    setRecord(detail.case); setAnswers(detail.case.answers); setFindings(detail.case.findings); setActions(detail.case.actions);
    setActivities(detail.activities ?? []); setEvidence(detail.evidence ?? []);
  }, [base]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => { if (selectedId) void loadCase(selectedId).catch(e => setError(e.message)); }, [selectedId, loadCase]);
  async function act(fn: () => Promise<void>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); await load(); if (selectedId) await loadCase(selectedId); setNotice(message); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }
  const editable = record && ["draft", "returned"].includes(record.status) && !manager;
  const caseBase = `${base}/diagnostics/${selectedId}`;
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-900 sm:px-6">
    <Link href="/dashboard/institutions" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800"><ArrowLeft size={17}/> Institution operations</Link>
    <header className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-8 text-white">
      <ClipboardList className="text-teal-300" size={30}/><p className="mt-4 text-xs font-bold uppercase tracking-widest text-teal-200">{institutionName}</p>
      <h1 className="mt-2 text-3xl font-black">Business diagnostics and development plans</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-200">Assess assigned businesses, agree practical actions, record support and submit the case for institution review.</p>
    </header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900">{notice}</p>}
    <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
      <aside className="space-y-5">
        {manager && <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-bold">Configure a diagnostic</h2>
          <p className="mt-1 text-xs text-slate-600">One question per line. Saving the same name creates a new version.</p>
          <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => {
            const questions = questionLines.split("\n").map(s => s.trim()).filter(Boolean).map((label, i) => ({ id: `q_${i+1}`, label }));
            await api(`${base}/diagnostic-templates`, "POST", { name: templateName, questions }); setTemplateName("");
          }, "Template saved."); }}><input required placeholder="Template name" className={input} value={templateName} onChange={e => setTemplateName(e.target.value)}/>
            <textarea required rows={5} className={input} value={questionLines} onChange={e => setQuestionLines(e.target.value)}/>
            <button disabled={busy} className={primary}>Save template version</button></form></section>}
        {!manager && <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-bold">Start a diagnosis</h2>
          <p className="mt-1 text-xs text-slate-600">Only active assignments with business sharing can begin.</p>
          <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => {
            const result = await api(`${base}/diagnostics`, "POST", { engagementId, templateId }); setSelectedId(result.case.id);
          }, "Diagnostic started."); }}>
            <select required className={input} value={engagementId} onChange={e => setEngagementId(e.target.value)}><option value="">Assigned business</option>{assignments.filter(a => !cases.some(c => c.engagement_id === a.engagement_id) && available.some(b => b.engagementId === a.engagement_id)).map(a => <option key={a.engagement_id} value={a.engagement_id}>{available.find(b => b.engagementId === a.engagement_id)?.businessName}</option>)}</select>
            <select required className={input} value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">Diagnostic template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name} · v{t.version}</option>)}</select>
            <button disabled={busy} className={primary}>Open case</button></form></section>}
        <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold">Daily work queue</h2><button aria-label="Refresh work queue" onClick={() => void load().catch(e => setError(e.message))}><RefreshCw size={16}/></button></div>
          <p className="mt-1 text-xs text-slate-600">Returned plans appear here with the next action.</p>
          <div className="mt-4 space-y-2">{cases.map(c => <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${selectedId === c.id ? "border-teal-700 bg-teal-50" : "border-slate-200"}`}><span className="block font-bold">{available.find(b => b.engagementId === c.engagement_id)?.businessName ?? "Business"}</span><span className="text-xs capitalize text-slate-600">{c.status.replaceAll("_", " ")}</span>{c.status === "returned" && <span className="mt-1 block text-xs text-amber-800">{c.next_action}</span>}</button>)}
            {!cases.length && <p className="text-sm text-slate-500">No diagnostic cases yet.</p>}</div></section>
      </aside>
      <section className="space-y-5">{!record ? <div className="rounded-3xl border bg-white p-8 text-sm text-slate-600">Choose a case to see the assessment and development plan.</div> : <>
        <div className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">{record.status.replaceAll("_", " ")}</p><h2 className="mt-1 text-xl font-bold">{available.find(b => b.engagementId === record.engagement_id)?.businessName ?? "Business"} · assessment and action plan</h2></div>{record.status === "approved" && <CheckCircle2 className="text-teal-700"/>}</div>
          {record.review_reason && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><strong>Returned:</strong> {record.review_reason}<br/><strong>Next:</strong> {record.next_action}</div>}
          <div className="mt-6 space-y-4">{record.questions.map(q => <label key={q.id} className="block text-sm font-semibold">{q.label}<textarea disabled={!editable} rows={2} className={`${input} mt-1`} value={answers[q.id] ?? ""} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}/></label>)}
            <label className="block text-sm font-semibold">Findings<textarea disabled={!editable} rows={4} className={`${input} mt-1`} value={findings} onChange={e => setFindings(e.target.value)}/></label>
            <div><div className="flex justify-between"><h3 className="font-bold">Recommended actions</h3>{editable && <button className={secondary} onClick={() => setActions([...actions, { title: "", owner: "business", dueDate: "" }])}>Add action</button>}</div>
              {actions.map((a, i) => <div key={i} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_9rem_9rem_auto]"><input disabled={!editable} placeholder="Specific action" className={input} value={a.title} onChange={e => setActions(actions.map((row,j) => j===i ? { ...row,title:e.target.value } : row))}/><select disabled={!editable} className={input} value={a.owner} onChange={e => setActions(actions.map((row,j) => j===i ? { ...row,owner:e.target.value as Action["owner"] } : row))}><option value="agent">Agent</option><option value="business">Business</option><option value="institution">Institution</option></select><input disabled={!editable} aria-label="Due date" type="date" className={input} value={a.dueDate} onChange={e => setActions(actions.map((row,j) => j===i ? { ...row,dueDate:e.target.value } : row))}/>{editable && <button type="button" className="text-sm text-rose-700" onClick={() => setActions(actions.filter((_,j) => j!==i))}>Remove</button>}</div>)}</div>
          </div>
          {editable && <div className="mt-6 flex flex-wrap gap-2"><button disabled={busy} className={secondary} onClick={() => void act(async () => { await api(caseBase,"PATCH",{answers,findings,actions}); },"Draft saved.")}>Save draft</button><button disabled={busy} className={primary} onClick={() => void act(async () => { await api(caseBase,"PATCH",{answers,findings,actions,submitForAgreement:true}); },"Plan sent to the business for agreement.")}>Request business agreement</button></div>}
          {record.status === "agreed" && !manager && <button disabled={busy} className={`${primary} mt-6`} onClick={() => void act(async () => { await api(`${caseBase}/workflow`,"PATCH",{action:"submit"}); },"Case submitted for review.")}>Submit for supervisor review</button>}
          {manager && record.status === "submitted" && <div className="mt-6 space-y-3 border-t pt-5"><h3 className="font-bold">Supervisor review</h3><textarea className={input} placeholder="Reason for return" value={reviewReason} onChange={e => setReviewReason(e.target.value)}/><input className={input} placeholder="Specific next action" value={nextAction} onChange={e => setNextAction(e.target.value)}/><div className="flex gap-2"><button disabled={busy} className={primary} onClick={() => void act(async () => { await api(`${caseBase}/workflow`,"PATCH",{action:"approve"}); },"Case approved.")}>Approve</button><button disabled={busy} className={secondary} onClick={() => void act(async () => { await api(`${caseBase}/workflow`,"PATCH",{action:"return",reason:reviewReason,nextAction}); },"Case returned to the agent.")}>Return with next action</button></div></div>}
        </div>
        <div className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">Services and evidence</h2><p className="mt-1 text-sm text-slate-600">Record mentorship and other support as the business develops.</p>
          {activities.map(a => <div key={a.id} className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><strong className="capitalize">{a.kind.replaceAll("_", " ")}</strong> · {new Date(a.occurred_at).toLocaleDateString()}<p>{a.summary}</p></div>)}
          {!manager && !["submitted","approved"].includes(record.status) && <form className="mt-4 grid gap-2 sm:grid-cols-[11rem_1fr_auto]" onSubmit={e => { e.preventDefault(); void act(async () => { await api(`${caseBase}/activities`,"POST",{kind:activityKind,summary:activitySummary,occurredAt:new Date().toISOString()}); setActivitySummary(""); },"Support recorded."); }}><select className={input} value={activityKind} onChange={e => setActivityKind(e.target.value)}>{["mentorship","training","document_review","market_linkage","other"].map(k => <option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}</select><input required className={input} placeholder="What support was provided?" value={activitySummary} onChange={e => setActivitySummary(e.target.value)}/><button disabled={busy} className={primary}>Record service</button></form>}
          <div className="mt-5 space-y-2">{evidence.map(item => <a key={item.id} className="block text-sm font-semibold text-teal-800 underline" href={`${caseBase}/evidence/${item.id}`}>{item.file_name}</a>)}</div>
          {!manager && !["submitted","approved"].includes(record.status) && <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm font-semibold text-teal-800"><FileUp size={18}/> Upload PDF or image evidence (10 MB max)<input type="file" className="sr-only" accept="application/pdf,image/png,image/jpeg" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (!file) return; void act(async () => { const form = new FormData(); form.set("file",file); await api(`${caseBase}/evidence`,"POST",form); e.target.value=""; },"Evidence uploaded."); }}/></label>}
        </div></>}</section>
    </div>
  </main>;
}
