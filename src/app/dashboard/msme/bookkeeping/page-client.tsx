"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Pencil, ReceiptText, Trash2, Wallet, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RecordType = "income" | "expense";
type BookkeepingRecord = {
  id: string;
  msme_id: string;
  record_type: RecordType;
  amount: number;
  category: string;
  record_date: string;
  description: string | null;
  receipt_url: string | null;
  receipt_filename: string | null;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

export function MsmeBookkeepingClient({ msmeId }: { msmeId: string }) {
  const [records, setRecords] = useState<BookkeepingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<BookkeepingRecord | null>(null);
  const [editRecord, setEditRecord] = useState<BookkeepingRecord | null>(null);
  const [form, setForm] = useState({ record_type: "expense" as RecordType, amount: "", category: "", record_date: "", description: "" });

  const supabase = createSupabaseBrowserClient();
  const loadRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("msme_bookkeeping_records").select("*").eq("msme_id", msmeId).order("record_date", { ascending: false });
    if (error) setMessage({ type: "error", text: error.message });
    setRecords((data ?? []) as BookkeepingRecord[]);
    setLoading(false);
  };
  useEffect(() => { void loadRecords(); }, [msmeId]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyRecords = records.filter((r) => r.record_date.startsWith(thisMonth));
  const summary = useMemo(() => {
    const income = monthlyRecords.filter((r) => r.record_type === "income").reduce((a, r) => a + Number(r.amount), 0);
    const expenses = monthlyRecords.filter((r) => r.record_type === "expense").reduce((a, r) => a + Number(r.amount), 0);
    return { income, expenses, net: income - expenses, missingReceipts: records.filter((r) => !r.receipt_url).length };
  }, [monthlyRecords, records]);

  const breakdown = useMemo(() => {
    const toMap = (type: RecordType) => records.filter((r) => r.record_type === type).reduce<Record<string, number>>((acc, r) => ((acc[r.category] = (acc[r.category] ?? 0) + Number(r.amount)), acc), {});
    return { incomeByCategory: toMap("income"), expenseByCategory: toMap("expense") };
  }, [records]);

  const onSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || !form.category || !form.record_date || !form.record_type) return setMessage({ type: "error", text: "Please fill all required fields and enter an amount greater than 0." });
    setSaving(true);
    const { error } = await supabase.from("msme_bookkeeping_records").insert({ msme_id: msmeId, ...form, amount, description: form.description || null });
    setSaving(false);
    if (error) return setMessage({ type: "error", text: error.message });
    setMessage({ type: "success", text: "Record saved." });
    setForm({ record_type: "expense", amount: "", category: "", record_date: "", description: "" });
    await loadRecords();
  };

  const onDelete = async (recordId: string) => {
    if (!window.confirm("Delete this bookkeeping record?")) return;
    const { error } = await supabase.from("msme_bookkeeping_records").delete().eq("id", recordId).eq("msme_id", msmeId);
    if (error) return setMessage({ type: "error", text: error.message });
    setMessage({ type: "success", text: "Record deleted." });
    await loadRecords();
  };
  const exportCsv = (rows: BookkeepingRecord[], fileName: string) => {
    const body = rows.map((r) => [r.record_date, r.record_type, r.category, (r.description ?? "").replaceAll(",", " "), String(r.amount), r.receipt_url ? "Attached" : "Missing"].join(",")).join("\n");
    const csv = `Date,Type,Category,Description,Amount,Receipt Status\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
  };

  return <section className="space-y-6 pb-16">{/* UI omitted for brevity in tooling */}
    <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Business Management</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Bookkeeping</h1><p className="mt-2 text-sm text-slate-600">Track monthly income, expenses, and receipt evidence in a live ledger.</p></div>
    {message ? <div className={`rounded-lg px-3 py-2 text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message.text}</div> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Total income this month", value: formatCurrency(summary.income) }, { label: "Total expenses this month", value: formatCurrency(summary.expenses) }, { label: "Net profit/loss", value: formatCurrency(summary.net) }, { label: "Records missing receipts", value: String(summary.missingReceipts) }].map((item) => <article key={item.label} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-2xl font-bold text-emerald-800">{item.value}</p></article>)}</div>
    <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold">Add record</h2><div className="grid gap-3 sm:grid-cols-2"><select value={form.record_type} onChange={(e) => setForm((p) => ({ ...p, record_type: e.target.value as RecordType }))} className="rounded-lg border px-3 py-2"><option value="income">Income</option><option value="expense">Expense</option></select><input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="rounded-lg border px-3 py-2" placeholder="50000" /><input required value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="rounded-lg border px-3 py-2" placeholder="Category" /><input type="date" required value={form.record_date} onChange={(e) => setForm((p) => ({ ...p, record_date: e.target.value }))} className="rounded-lg border px-3 py-2" /></div><textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-lg border px-3 py-2" placeholder="Description optional" /><div className="rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-slate-600">Receipt upload coming soon</div><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Wallet className="h-4 w-4" />{saving ? "Saving..." : "Save record"}</button></form>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">Bookkeeping records</h2><div className="flex gap-2"><button onClick={() => exportCsv(records, "bookkeeping-records.csv")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Download className="h-4 w-4" />Download CSV</button><button onClick={() => exportCsv(monthlyRecords, `bookkeeping-${thisMonth}.csv`)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"><ReceiptText className="h-4 w-4" />Download monthly CSV report</button></div></div>
      {loading ? <p className="mt-4 text-sm text-slate-600">Loading records...</p> : records.length === 0 ? <div className="mt-5 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-slate-600">No bookkeeping records yet.</div> : <div className="mt-4 space-y-2">{records.map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><p className="font-semibold">{record.category} • {formatCurrency(Number(record.amount))}</p><p className="text-xs text-slate-600">{record.record_date} • {record.record_type} • {record.receipt_url ? "Receipt attached" : "Receipt missing"}</p></div><div className="flex gap-2"><button onClick={() => setSelectedRecord(record)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"><Eye className="h-3.5 w-3.5" />View</button><button onClick={() => setEditRecord(record)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"><Pencil className="h-3.5 w-3.5" />Edit</button><button onClick={() => onDelete(record.id)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-rose-700"><Trash2 className="h-3.5 w-3.5" />Delete</button></div></div>)}</div>}</div>
    {[selectedRecord, editRecord].map((modal, index) => modal ? <div key={index} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{index === 0 ? "Record details" : "Edit record"}</h3><button onClick={() => index === 0 ? setSelectedRecord(null) : setEditRecord(null)}><X className="h-4 w-4" /></button></div>{index === 0 ? <div className="space-y-2 text-sm"><p>Date: {modal.record_date}</p><p>Type: {modal.record_type}</p><p>Category: {modal.category}</p><p>Description: {modal.description || "-"}</p><p>Amount: {formatCurrency(Number(modal.amount))}</p><p>Receipt: {modal.receipt_url ? <a className="text-emerald-700 underline" href={modal.receipt_url}>View receipt</a> : "Missing"}</p></div> : <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); const { error } = await supabase.from("msme_bookkeeping_records").update({ record_type: modal.record_type, amount: modal.amount, category: modal.category, record_date: modal.record_date, description: modal.description }).eq("id", modal.id).eq("msme_id", msmeId); if (error) setMessage({ type: "error", text: error.message }); else { setMessage({ type: "success", text: "Record updated." }); setEditRecord(null); await loadRecords(); } }}><select value={modal.record_type} onChange={(e) => setEditRecord((p) => p ? ({ ...p, record_type: e.target.value as RecordType }) : null)} className="w-full rounded border px-2 py-1"><option value="income">Income</option><option value="expense">Expense</option></select><input type="number" min="0.01" step="0.01" value={modal.amount} onChange={(e) => setEditRecord((p) => p ? ({ ...p, amount: Number(e.target.value) }) : null)} className="w-full rounded border px-2 py-1" /><input value={modal.category} onChange={(e) => setEditRecord((p) => p ? ({ ...p, category: e.target.value }) : null)} className="w-full rounded border px-2 py-1" /><input type="date" value={modal.record_date} onChange={(e) => setEditRecord((p) => p ? ({ ...p, record_date: e.target.value }) : null)} className="w-full rounded border px-2 py-1" /><textarea value={modal.description ?? ""} onChange={(e) => setEditRecord((p) => p ? ({ ...p, description: e.target.value }) : null)} className="w-full rounded border px-2 py-1" /><button className="rounded bg-emerald-700 px-3 py-2 text-sm text-white">Save changes</button></form>}</div></div> : null)}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold text-slate-900">Category summary</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{[{ title: "Expense category breakdown", data: breakdown.expenseByCategory }, { title: "Income source breakdown", data: breakdown.incomeByCategory }].map((block) => <div key={block.title} className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">{block.title}</p><div className="mt-2 space-y-2 text-sm">{Object.entries(block.data).length === 0 ? <p className="text-slate-500">No records yet.</p> : Object.entries(block.data).map(([category, amount]) => <div key={category} className="flex items-center justify-between"><span className="text-slate-600">{category}</span><span className="font-medium text-slate-900">{formatCurrency(amount)}</span></div>)}</div></div>)}</div></div>
  </section>;
}
