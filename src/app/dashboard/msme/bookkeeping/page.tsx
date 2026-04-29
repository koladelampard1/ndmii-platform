"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, Pencil, ReceiptText, Save, Wallet, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RecordType = "Income" | "Expense";
type BookkeepingRecord = { id: string; date: string; type: RecordType; category: string; description: string; amount: number; receipt_url: string | null };

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
const categoriesByType: Record<RecordType, string[]> = {
  Income: ["Retail sales", "Transfer", "Service income", "Wholesale", "Other income"],
  Expense: ["Inventory", "Utilities", "Rent", "Logistics", "Staff", "Other expense"],
};

const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export default function MsmeBookkeepingPage() {
  const supabase = createSupabaseBrowserClient();
  const [records, setRecords] = useState<BookkeepingRecord[]>([]);
  const [form, setForm] = useState({ type: "Expense" as RecordType, amount: "", category: "Inventory", date: "", description: "", receiptFile: null as File | null });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ type: "Expense" as RecordType, amount: "", category: "", date: "", description: "", receiptFile: null as File | null, existingReceiptUrl: null as string | null });

  const loadRecords = useCallback(async () => {
    const { data } = await supabase.from("msme_bookkeeping_records").select("id,date,type,category,description,amount,receipt_url").order("date", { ascending: false });
    setRecords((data ?? []).map((row) => ({
      id: String(row.id),
      date: String(row.date),
      type: (row.type === "Income" ? "Income" : "Expense") as RecordType,
      category: String(row.category ?? ""),
      description: String(row.description ?? ""),
      amount: Number(row.amount ?? 0),
      receipt_url: row.receipt_url ? String(row.receipt_url) : null,
    })));
  }, [supabase]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const summary = useMemo(() => {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const monthRecords = records.filter((record) => record.date.startsWith(monthPrefix));
    const income = monthRecords.filter((record) => record.type === "Income").reduce((sum, record) => sum + record.amount, 0);
    const expenses = monthRecords.filter((record) => record.type === "Expense").reduce((sum, record) => sum + record.amount, 0);
    return { income, expenses, net: income - expenses, missingReceipts: monthRecords.filter((record) => !record.receipt_url).length };
  }, [records]);

  const breakdown = useMemo(() => {
    const toMap = (type: RecordType) => records.filter((record) => record.type === type).reduce<Record<string, number>>((acc, record) => ((acc[record.category] = (acc[record.category] ?? 0) + record.amount), acc), {});
    return { incomeByCategory: toMap("Income"), expenseByCategory: toMap("Expense") };
  }, [records]);

  const uploadReceipt = async (file: File) => {
    const path = `bookkeeping/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("msme-receipts").upload(path, file, { upsert: true });
    if (error) return null;
    return supabase.storage.from("msme-receipts").getPublicUrl(path).data.publicUrl;
  };

  const addRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.amount || !form.category || !form.date || !form.description) return;
    const receiptUrl = form.receiptFile ? await uploadReceipt(form.receiptFile) : null;
    await supabase.from("msme_bookkeeping_records").insert({ type: form.type, amount: Number(form.amount), category: form.category, date: form.date, description: form.description, receipt_url: receiptUrl });
    setForm({ type: "Expense", amount: "", category: "Inventory", date: "", description: "", receiptFile: null });
    await loadRecords();
  };

  const handleViewReceipt = (receiptUrl: string | null) => {
    if (receiptUrl) window.open(receiptUrl, "_blank");
    else window.alert("No receipt attached");
  };

  const beginEdit = (record: BookkeepingRecord) => {
    setEditingId(record.id);
    setEditForm({ type: record.type, amount: String(record.amount), category: record.category, date: record.date, description: record.description, receiptFile: null, existingReceiptUrl: record.receipt_url });
  };

  const saveEdit = async (id: string) => {
    const nextReceiptUrl = editForm.receiptFile ? await uploadReceipt(editForm.receiptFile) : editForm.existingReceiptUrl;
    await supabase.from("msme_bookkeeping_records").update({ type: editForm.type, category: editForm.category, amount: Number(editForm.amount), date: editForm.date, description: editForm.description, receipt_url: nextReceiptUrl }).eq("id", id);
    setEditingId(null);
    await loadRecords();
  };

  const downloadCsv = () => {
    const header = ["Date", "Type", "Category", "Description", "Amount", "Receipt status"];
    const rows = records.map((record) => [record.date, record.type, record.category, record.description, record.amount, record.receipt_url ? "Attached" : "Missing"]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bookkeeping-records.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return <section className="space-y-6 pb-16"><div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Business Management</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Bookkeeping</h1><p className="mt-2 text-sm text-slate-600">Track monthly income, expenses, and receipt evidence in a safe MVP ledger.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Total income this month", value: formatCurrency(summary.income) }, { label: "Total expenses this month", value: formatCurrency(summary.expenses) }, { label: "Net profit/loss", value: formatCurrency(summary.net) }, { label: "Records missing receipts", value: String(summary.missingReceipts) }].map((item) => <article key={item.label} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-2xl font-bold text-emerald-800">{item.value}</p></article>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]"><form onSubmit={(e) => { void addRecord(e); }} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold text-slate-900">Add record</h2><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Record type</span><select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as RecordType, category: categoriesByType[e.target.value as RecordType][0] }))} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option>Income</option><option>Expense</option></select></label><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Amount</span><input type="number" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="50000" required /></label><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Category</span><select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required>{categoriesByType[form.type].map((category) => <option key={category}>{category}</option>)}</select></label><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Date</span><input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></label></div><label className="block space-y-1 text-sm"><span className="font-medium text-slate-700">Description / notes</span><textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Brief details of transaction" required /></label><label className="block space-y-1 text-sm"><span className="font-medium text-slate-700">Receipt/evidence upload (placeholder)</span><input type="file" accept="image/*,.pdf" onChange={(e) => setForm((p) => ({ ...p, receiptFile: e.target.files?.[0] ?? null }))} className="w-full rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-2" /></label><button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><Wallet className="h-4 w-4" />Save record</button></form>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold text-slate-900">Category summary</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{[{ title: "Expense category breakdown", data: breakdown.expenseByCategory }, { title: "Income source breakdown", data: breakdown.incomeByCategory }].map((block) => <div key={block.title} className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">{block.title}</p><div className="mt-2 space-y-2 text-sm">{Object.entries(block.data).length === 0 ? <p className="text-slate-500">No records yet.</p> : Object.entries(block.data).map(([category, amount]) => <div key={category} className="flex items-center justify-between"><span className="text-slate-600">{category}</span><span className="font-medium text-slate-900">{formatCurrency(amount)}</span></div>)}</div></div>)}</div></div></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">Bookkeeping records</h2><div className="flex flex-wrap gap-2"><button type="button" onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Download CSV</button><button type="button" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"><ReceiptText className="h-4 w-4" />Download monthly report</button></div></div>
      {records.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">No bookkeeping records yet. Use the form above to add your first income or expense entry.</div> : <><div className="mt-4 hidden overflow-x-auto lg:block"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-slate-600"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Receipt status</th><th className="px-3 py-2">Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-slate-100 align-top"><td className="px-3 py-2">{editingId === record.id ? <input type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1" /> : record.date}</td><td className="px-3 py-2">{editingId === record.id ? <select value={editForm.type} onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as RecordType, category: categoriesByType[e.target.value as RecordType][0] }))} className="rounded border border-slate-300 px-2 py-1"><option>Income</option><option>Expense</option></select> : <span className={`rounded-full px-2 py-1 text-xs ${record.type === "Income" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{record.type}</span>}</td><td className="px-3 py-2">{editingId === record.id ? <select value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} className="rounded border border-slate-300 px-2 py-1">{categoriesByType[editForm.type].map((category) => <option key={category}>{category}</option>)}</select> : record.category}</td><td className="px-3 py-2 text-slate-600">{editingId === record.id ? <input value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1" /> : record.description}</td><td className="px-3 py-2 font-medium">{editingId === record.id ? <input type="number" min="0" value={editForm.amount} onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1" /> : formatCurrency(record.amount)}</td><td className="px-3 py-2">{record.receipt_url ? "Attached" : "Missing"}{editingId === record.id ? <input type="file" accept="image/*,.pdf" onChange={(e) => setEditForm((p) => ({ ...p, receiptFile: e.target.files?.[0] ?? null }))} className="mt-1 block w-full text-xs" /> : null}</td><td className="px-3 py-2"><div className="flex gap-2">{editingId === record.id ? <><button type="button" onClick={() => { void saveEdit(record.id); }} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Save className="h-3.5 w-3.5" />Save</button><button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><X className="h-3.5 w-3.5" />Cancel</button></> : <><button type="button" onClick={() => handleViewReceipt(record.receipt_url)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Eye className="h-3.5 w-3.5" />View</button><button type="button" onClick={() => beginEdit(record)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Pencil className="h-3.5 w-3.5" />Edit</button></>}</div></td></tr>)}</tbody></table></div><div className="mt-4 grid gap-3 lg:hidden">{records.map((record) => <article key={record.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{record.category}</p><span className={`rounded-full px-2 py-1 text-xs ${record.type === "Income" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{record.type}</span></div><p className="mt-1 text-sm text-slate-600">{record.description}</p><p className="mt-2 text-xs text-slate-500">{record.date}</p><div className="mt-3 flex items-center justify-between"><p className="font-semibold text-slate-900">{formatCurrency(record.amount)}</p><p className="text-xs text-slate-600">{record.receipt_url ? "Receipt attached" : "Receipt missing"}</p></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => handleViewReceipt(record.receipt_url)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs"><Eye className="h-3.5 w-3.5" />View</button><button type="button" onClick={() => beginEdit(record)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs"><Pencil className="h-3.5 w-3.5" />Edit</button></div></article>)}</div></>}</div>
  </section>;
}
