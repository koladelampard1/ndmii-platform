"use client";

import { useMemo, useState } from "react";
import { Download, Eye, Pencil, ReceiptText, Wallet } from "lucide-react";

type RecordType = "Income" | "Expense";
type BookkeepingRecord = {
  id: string;
  msmeId: string;
  date: string;
  type: RecordType;
  category: string;
  description: string;
  amount: number;
  hasReceipt: boolean;
  receiptFilename?: string;
  receiptUrl?: string;
};

type EditForm = { type: RecordType; category: string; amount: string; date: string; description: string; receiptName: string };

const CURRENT_MSME_ID = "msme-demo-001";
const seedRecords: BookkeepingRecord[] = [
  { id: "bk-001", msmeId: CURRENT_MSME_ID, date: "2026-04-03", type: "Income", category: "Retail sales", description: "Walk-in customer purchases", amount: 285000, hasReceipt: true, receiptFilename: "sales-0403.pdf", receiptUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: "bk-002", msmeId: CURRENT_MSME_ID, date: "2026-04-06", type: "Expense", category: "Inventory", description: "Restocked packaged food items", amount: 120000, hasReceipt: true, receiptFilename: "inventory-0406.jpg", receiptUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3" },
  { id: "bk-003", msmeId: CURRENT_MSME_ID, date: "2026-04-13", type: "Expense", category: "Logistics", description: "Inter-state delivery fuel", amount: 28500, hasReceipt: false },
  { id: "bk-004", msmeId: CURRENT_MSME_ID, date: "2026-04-18", type: "Income", category: "Transfer", description: "Corporate bulk order payment", amount: 430000, hasReceipt: true, receiptFilename: "transfer-0418.docx", receiptUrl: "https://file-examples.com/storage/fef7c40f72f2d37f2123321/2017/02/file-sample_100kB.docx" },
  { id: "bk-005", msmeId: CURRENT_MSME_ID, date: "2026-04-21", type: "Expense", category: "Utilities", description: "Generator servicing and diesel", amount: 52000, hasReceipt: false },
];
const formatCurrency = (amount: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

export default function MsmeBookkeepingPage() {
  const [records, setRecords] = useState<BookkeepingRecord[]>(seedRecords);
  const [form, setForm] = useState({ type: "Expense" as RecordType, amount: "", category: "", date: "", description: "", receiptName: "" });
  const [activeMessage, setActiveMessage] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string>("");

  const summary = useMemo(() => {
    const income = records.filter((record) => record.type === "Income").reduce((sum, record) => sum + record.amount, 0);
    const expenses = records.filter((record) => record.type === "Expense").reduce((sum, record) => sum + record.amount, 0);
    return { income, expenses, net: income - expenses, missingReceipts: records.filter((record) => !record.hasReceipt).length };
  }, [records]);

  const breakdown = useMemo(() => {
    const toMap = (type: RecordType) => records.filter((record) => record.type === type).reduce<Record<string, number>>((acc, record) => ((acc[record.category] = (acc[record.category] ?? 0) + record.amount), acc), {});
    return { incomeByCategory: toMap("Income"), expenseByCategory: toMap("Expense") };
  }, [records]);

  const addRecord = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.amount || !form.category || !form.date || !form.description) return;
    setRecords((previous) => [{ id: `bk-${Date.now()}`, msmeId: CURRENT_MSME_ID, type: form.type, amount: Number(form.amount), category: form.category, date: form.date, description: form.description, hasReceipt: Boolean(form.receiptName), receiptFilename: form.receiptName || undefined, receiptUrl: form.receiptName ? "about:blank" : undefined }, ...previous]);
    setForm({ type: "Expense", amount: "", category: "", date: "", description: "", receiptName: "" });
  };

  const viewReceipt = (record: BookkeepingRecord) => {
    if (record.msmeId !== CURRENT_MSME_ID) {
      setActiveMessage("You can only view receipts from your own MSME account");
      return;
    }
    if (!record.receiptUrl) {
      setActiveMessage("No receipt attached");
      return;
    }
    setActiveMessage("");
    window.open(record.receiptUrl, "_blank");
  };

  const startEdit = (record: BookkeepingRecord) => {
    setEditingId(record.id);
    setEditError("");
    setActiveMessage("");
    setEditForm({ type: record.type, category: record.category, amount: String(record.amount), date: record.date, description: record.description, receiptName: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError("");
    setEditForm(null);
  };

  const saveEdit = () => {
    if (!editingId || !editForm) return;
    if (!editForm.type || !editForm.category || !editForm.date) {
      setEditError("Type, category and date are required");
      return;
    }
    if (!editForm.amount || Number.isNaN(Number(editForm.amount))) {
      setEditError("Amount must be numeric");
      return;
    }
    setRecords((prev) => prev.map((record) => {
      if (record.id !== editingId) return record;
      const replaceReceipt = editForm.receiptName.trim().length > 0;
      return {
        ...record,
        type: editForm.type,
        category: editForm.category,
        date: editForm.date,
        description: editForm.description,
        amount: Number(editForm.amount),
        hasReceipt: replaceReceipt ? true : record.hasReceipt,
        receiptFilename: replaceReceipt ? editForm.receiptName.trim() : record.receiptFilename,
        receiptUrl: replaceReceipt ? "about:blank" : record.receiptUrl,
      };
    }));
    cancelEdit();
  };

  return <section className="space-y-6 pb-16"><div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Business Management</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Bookkeeping</h1><p className="mt-2 text-sm text-slate-600">Track monthly income, expenses, and receipt evidence in a safe MVP ledger. Data is local to this session.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Total income this month", value: formatCurrency(summary.income) }, { label: "Total expenses this month", value: formatCurrency(summary.expenses) }, { label: "Net profit/loss", value: formatCurrency(summary.net) }, { label: "Records missing receipts", value: String(summary.missingReceipts) }].map((item) => <article key={item.label} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-2xl font-bold text-emerald-800">{item.value}</p></article>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]"><form onSubmit={addRecord} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold text-slate-900">Add record</h2><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Record type</span><select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as RecordType }))} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option>Income</option><option>Expense</option></select></label><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Amount</span><input type="number" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="50000" required /></label><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Category</span><input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Inventory, Sales, Utilities" required /></label><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Date</span><input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></label></div><label className="block space-y-1 text-sm"><span className="font-medium text-slate-700">Description / notes</span><textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Brief details of transaction" required /></label><label className="block space-y-1 text-sm"><span className="font-medium text-slate-700">Receipt/evidence upload (placeholder)</span><input type="text" value={form.receiptName} onChange={(e) => setForm((p) => ({ ...p, receiptName: e.target.value }))} placeholder="receipt-april.pdf" className="w-full rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-2" /></label><button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><Wallet className="h-4 w-4" />Save record</button></form>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold text-slate-900">Category summary</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{[{ title: "Expense category breakdown", data: breakdown.expenseByCategory }, { title: "Income source breakdown", data: breakdown.incomeByCategory }].map((block) => <div key={block.title} className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">{block.title}</p><div className="mt-2 space-y-2 text-sm">{Object.entries(block.data).length === 0 ? <p className="text-slate-500">No records yet.</p> : Object.entries(block.data).map(([category, amount]) => <div key={category} className="flex items-center justify-between"><span className="text-slate-600">{category}</span><span className="font-medium text-slate-900">{formatCurrency(amount)}</span></div>)}</div></div>)}</div></div></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">Bookkeeping records</h2><div className="flex flex-wrap gap-2"><button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Download CSV</button><button type="button" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"><ReceiptText className="h-4 w-4" />Download monthly report</button></div></div>
      {activeMessage && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{activeMessage}</p>}
      {records.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">No bookkeeping records yet. Use the form above to add your first income or expense entry.</div> : <><div className="mt-4 hidden overflow-x-auto lg:block"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-slate-600"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Receipt status</th><th className="px-3 py-2">Actions</th></tr></thead><tbody>{records.map((record) => editingId === record.id && editForm ? <tr key={record.id} className="border-b border-slate-100 align-top"><td className="px-3 py-2"><input type="date" value={editForm.date} onChange={(e) => setEditForm((p) => p ? { ...p, date: e.target.value } : p)} className="w-full rounded-md border border-slate-300 px-2 py-1" /></td><td className="px-3 py-2"><select value={editForm.type} onChange={(e) => setEditForm((p) => p ? { ...p, type: e.target.value as RecordType } : p)} className="w-full rounded-md border border-slate-300 px-2 py-1"><option>Income</option><option>Expense</option></select></td><td className="px-3 py-2"><input value={editForm.category} onChange={(e) => setEditForm((p) => p ? { ...p, category: e.target.value } : p)} className="w-full rounded-md border border-slate-300 px-2 py-1" /></td><td className="px-3 py-2 text-slate-600"><textarea value={editForm.description} onChange={(e) => setEditForm((p) => p ? { ...p, description: e.target.value } : p)} rows={2} className="w-full rounded-md border border-slate-300 px-2 py-1" /></td><td className="px-3 py-2 font-medium"><input type="number" value={editForm.amount} onChange={(e) => setEditForm((p) => p ? { ...p, amount: e.target.value } : p)} className="w-full rounded-md border border-slate-300 px-2 py-1" /></td><td className="px-3 py-2"><div className="space-y-2"><p>{record.hasReceipt ? "Attached" : "Missing"}</p><input value={editForm.receiptName} onChange={(e) => setEditForm((p) => p ? { ...p, receiptName: e.target.value } : p)} placeholder="replace-receipt.pdf" className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs" /></div></td><td className="px-3 py-2"><div className="flex gap-2"><button type="button" onClick={saveEdit} className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-1 text-white">Save changes</button><button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1">Cancel</button></div>{editError && <p className="mt-2 text-xs text-red-600">{editError}</p>}</td></tr> : <tr key={record.id} className="border-b border-slate-100 align-top"><td className="px-3 py-2">{record.date}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs ${record.type === "Income" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{record.type}</span></td><td className="px-3 py-2">{record.category}</td><td className="px-3 py-2 text-slate-600">{record.description}</td><td className="px-3 py-2 font-medium">{formatCurrency(record.amount)}</td><td className="px-3 py-2">{record.hasReceipt ? "Attached" : "Missing"}</td><td className="px-3 py-2"><div className="flex gap-2"><button type="button" onClick={() => viewReceipt(record)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Eye className="h-3.5 w-3.5" />View</button><button type="button" onClick={() => startEdit(record)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Pencil className="h-3.5 w-3.5" />Edit</button></div></td></tr>)}</tbody></table></div><div className="mt-4 grid gap-3 lg:hidden">{records.map((record) => <article key={record.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{record.category}</p><span className={`rounded-full px-2 py-1 text-xs ${record.type === "Income" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{record.type}</span></div><p className="mt-1 text-sm text-slate-600">{record.description}</p><p className="mt-2 text-xs text-slate-500">{record.date}</p><div className="mt-3 flex items-center justify-between"><p className="font-semibold text-slate-900">{formatCurrency(record.amount)}</p><p className="text-xs text-slate-600">{record.hasReceipt ? "Receipt attached" : "Receipt missing"}</p></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => viewReceipt(record)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs"><Eye className="h-3.5 w-3.5" />View</button><button type="button" onClick={() => startEdit(record)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs"><Pencil className="h-3.5 w-3.5" />Edit</button></div></article>)}</div></>}</div>
  </section>;
}
