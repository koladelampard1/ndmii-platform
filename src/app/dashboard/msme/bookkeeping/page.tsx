"use client";

import { useMemo, useState } from "react";
import { Download, Eye, Pencil, ReceiptText, Wallet } from "lucide-react";

type RecordType = "Income" | "Expense";
type BookkeepingRecord = { id: string; date: string; type: RecordType; category: string; description: string; amount: number; receipt_url: string | null; receipt_filename: string | null };
const seedRecords: BookkeepingRecord[] = [
  { id: "bk-001", date: "2026-04-03", type: "Income", category: "Retail sales", description: "Walk-in customer purchases", amount: 285000, receipt_url: "#", receipt_filename: "retail-sales.pdf" },
  { id: "bk-002", date: "2026-04-06", type: "Expense", category: "Inventory", description: "Restocked packaged food items", amount: 120000, receipt_url: "#", receipt_filename: "inventory.png" },
  { id: "bk-003", date: "2026-04-13", type: "Expense", category: "Logistics", description: "Inter-state delivery fuel", amount: 28500, receipt_url: null, receipt_filename: null },
];
const formatCurrency = (amount: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

export default function MsmeBookkeepingPage() {
  const [records, setRecords] = useState<BookkeepingRecord[]>(seedRecords);
  const [form, setForm] = useState({ type: "Expense" as RecordType, amount: "", category: "", date: "", description: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const summary = useMemo(() => {
    const income = records.filter((record) => record.type === "Income").reduce((sum, record) => sum + record.amount, 0);
    const expenses = records.filter((record) => record.type === "Expense").reduce((sum, record) => sum + record.amount, 0);
    return { income, expenses, net: income - expenses, missingReceipts: records.filter((record) => !record.receipt_url).length };
  }, [records]);

  const addRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!form.amount || !form.category || !form.date || !form.description) return;
    setIsSaving(true);
    try {
      const body = new FormData();
      body.set("type", form.type);
      body.set("amount", form.amount);
      body.set("category", form.category);
      body.set("date", form.date);
      body.set("description", form.description);
      if (selectedFile) body.set("receipt", selectedFile);
      const response = await fetch("/api/msme/bookkeeping/records", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Failed to save record.");
      setRecords((prev) => [payload.record as BookkeepingRecord, ...prev]);
      setForm({ type: "Expense", amount: "", category: "", date: "", description: "" });
      setSelectedFile(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save record.");
    } finally {
      setIsSaving(false);
    }
  };

  return <section className="space-y-6 pb-16"><div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Business Management</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Bookkeeping</h1></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Total income this month", value: formatCurrency(summary.income) }, { label: "Total expenses this month", value: formatCurrency(summary.expenses) }, { label: "Net profit/loss", value: formatCurrency(summary.net) }, { label: "Records missing receipts", value: String(summary.missingReceipts) }].map((item) => <article key={item.label} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-2xl font-bold text-emerald-800">{item.value}</p></article>)}</div>
    <form onSubmit={addRecord} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold text-slate-900">Add record</h2>
      <div className="grid gap-3 sm:grid-cols-2"><input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Category" required />
      <input type="number" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="50000" required /></div>
      <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
      <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
      <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} className="w-full rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-2" />
      {selectedFile ? <p className="text-xs text-slate-600">Selected: {selectedFile.name}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Wallet className="h-4 w-4" />{isSaving ? "Saving..." : "Save record"}</button></form>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><table className="min-w-full text-sm"><thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Receipt</th><th>Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{record.date}</td><td>{record.category}</td><td>{formatCurrency(record.amount)}</td><td>{record.receipt_url ? "Attached" : "Missing"}</td><td><div className="flex gap-2">{record.receipt_url ? <a href={record.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Eye className="h-3.5 w-3.5" />View receipt</a> : <span className="text-xs text-slate-500">No receipt</span>}<button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Pencil className="h-3.5 w-3.5" />Edit</button></div></td></tr>)}</tbody></table></div>
  </section>;
}
