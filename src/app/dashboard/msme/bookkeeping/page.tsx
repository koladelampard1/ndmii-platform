"use client";

import { Download, Eye, Pencil, ReceiptText, Wallet } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type RecordType = "Income" | "Expense";

type BookkeepingRecord = {
  id: string;
  date: string;
  type: RecordType;
  category: string;
  description: string;
  amount: number;
  receiptUrl?: string;
  receiptFilename?: string;
};

const INCOME_CATEGORIES = ["Retail sales", "Transfer", "Wholesale", "Service fees", "Other"];
const EXPENSE_CATEGORIES = ["Inventory", "Utilities", "Logistics", "Rent", "Salaries", "Other"];
const CUSTOM_CATEGORY_VALUE = "__custom__";
const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx"]);

const seedRecords: BookkeepingRecord[] = [
  { id: "bk-001", date: "2026-04-03", type: "Income", category: "Retail sales", description: "Walk-in customer purchases", amount: 285000, receiptFilename: "walkin-apr03.jpg", receiptUrl: "#" },
  { id: "bk-002", date: "2026-04-06", type: "Expense", category: "Inventory", description: "Restocked packaged food items", amount: 120000, receiptFilename: "inventory-apr06.pdf", receiptUrl: "#" },
  { id: "bk-003", date: "2026-04-13", type: "Expense", category: "Logistics", description: "Inter-state delivery fuel", amount: 28500 },
  { id: "bk-004", date: "2026-04-18", type: "Income", category: "Transfer", description: "Corporate bulk order payment", amount: 430000, receiptFilename: "transfer-apr18.png", receiptUrl: "#" },
  { id: "bk-005", date: "2026-04-21", type: "Expense", category: "Utilities", description: "Generator servicing and diesel", amount: 52000 },
];

const formatCurrency = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);

export default function MsmeBookkeepingPage() {
  const [records, setRecords] = useState<BookkeepingRecord[]>(seedRecords);
  const [form, setForm] = useState({ type: "Expense" as RecordType, amount: "", category: "", customCategory: "", date: "", description: "" });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const categories = form.type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const selectedCategory = form.category === CUSTOM_CATEGORY_VALUE ? form.customCategory : form.category;

  const summary = useMemo(() => {
    const income = records.filter((record) => record.type === "Income").reduce((sum, record) => sum + record.amount, 0);
    const expenses = records.filter((record) => record.type === "Expense").reduce((sum, record) => sum + record.amount, 0);
    const missingReceipts = records.filter((record) => !record.receiptUrl).length;
    return { income, expenses, net: income - expenses, missingReceipts };
  }, [records]);

  const breakdown = useMemo(() => {
    const toMap = (type: RecordType) => records.filter((record) => record.type === type).reduce<Record<string, number>>((acc, record) => {
      acc[record.category] = (acc[record.category] ?? 0) + record.amount;
      return acc;
    }, {});

    return {
      expenseByCategory: toMap("Expense"),
      incomeByCategory: toMap("Income"),
    };
  }, [records]);

  async function uploadReceiptForRecord(recordId: string, file: File) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!recordId) throw new Error("Missing record ID");
    return { receiptUrl: URL.createObjectURL(file), receiptFilename: file.name };
  }

  const onReceiptChange = (file: File | null) => {
    setError("");
    if (!file) {
      setReceiptFile(null);
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_RECEIPT_EXTENSIONS.has(extension)) {
      setReceiptFile(null);
      setError("Invalid receipt file type. Allowed: jpg, jpeg, png, webp, pdf, doc, docx.");
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE_BYTES) {
      setReceiptFile(null);
      setError("Receipt file is too large. Maximum allowed size is 10MB.");
      return;
    }
    setReceiptFile(file);
  };

  const addRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");

    if (!form.amount || !selectedCategory.trim() || !form.date || !form.description.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    const newRecord: BookkeepingRecord = {
      id: `bk-${Date.now()}`,
      type: form.type,
      amount: Number(form.amount),
      category: selectedCategory.trim(),
      date: form.date,
      description: form.description.trim(),
    };

    setRecords((previous) => [newRecord, ...previous]);
    setForm({ type: "Expense", amount: "", category: "", customCategory: "", date: "", description: "" });

    if (!receiptFile) {
      setStatusMessage("Record saved.");
      return;
    }

    try {
      const uploaded = await uploadReceiptForRecord(newRecord.id, receiptFile);
      setRecords((previous) => previous.map((record) => (record.id === newRecord.id ? { ...record, receiptFilename: uploaded.receiptFilename, receiptUrl: uploaded.receiptUrl } : record)));
      setStatusMessage("Record and receipt saved.");
    } catch {
      setStatusMessage("Record saved, but receipt upload failed.");
    } finally {
      setReceiptFile(null);
    }
  };

  const downloadCsv = () => {
    const header = ["Date", "Type", "Category", "Description", "Amount", "Receipt Status", "Receipt Filename"];
    const rows = records.map((record) => [record.date, record.type, record.category, record.description, String(record.amount), record.receiptUrl ? "Attached" : "Missing", record.receiptFilename ?? ""]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bookkeeping-records.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <section className="space-y-6 pb-16"><div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Business Management</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Bookkeeping</h1><p className="mt-2 text-sm text-slate-600">Track monthly income, expenses, and receipt evidence in a safe MVP ledger. Data is local to this session.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Total income this month", value: formatCurrency(summary.income) }, { label: "Total expenses this month", value: formatCurrency(summary.expenses) }, { label: "Net profit/loss", value: formatCurrency(summary.net) }, { label: "Records missing receipts", value: String(summary.missingReceipts) }].map((item) => <article key={item.label} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-2xl font-bold text-emerald-800">{item.value}</p></article>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]"><form onSubmit={addRecord} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold text-slate-900">Add record</h2><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Record type</span><select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as RecordType, category: "", customCategory: "" }))} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option>Income</option><option>Expense</option></select></label><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Amount</span><input type="number" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="50000" required /></label><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Category</span><select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required><option value="">Select category</option>{categories.map((category) => <option key={category} value={category === "Other" ? CUSTOM_CATEGORY_VALUE : category}>{category}</option>)}</select></label><label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Date</span><input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></label></div>
      {form.category === CUSTOM_CATEGORY_VALUE ? <label className="block space-y-1 text-sm"><span className="font-medium text-slate-700">Custom category</span><input value={form.customCategory} onChange={(e) => setForm((p) => ({ ...p, customCategory: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter custom category" required /></label> : null}
      <label className="block space-y-1 text-sm"><span className="font-medium text-slate-700">Description / notes</span><textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Brief details of transaction" required /></label>
      <label className="block space-y-1 text-sm"><span className="font-medium text-slate-700">Receipt upload (optional)</span><input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx" onChange={(e) => onReceiptChange(e.target.files?.[0] ?? null)} className="w-full rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-2" /><p className="text-xs text-slate-600">{receiptFile ? `Selected: ${receiptFile.name}` : "No file selected"}</p></label>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {statusMessage ? <p className="text-sm text-emerald-700">{statusMessage}</p> : null}
      <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><Wallet className="h-4 w-4" />Save record</button></form>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold text-slate-900">Category summary</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{[{ title: "Expense category breakdown", data: breakdown.expenseByCategory }, { title: "Income source breakdown", data: breakdown.incomeByCategory }].map((block) => <div key={block.title} className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">{block.title}</p><div className="mt-2 space-y-2 text-sm">{Object.entries(block.data).length === 0 ? <p className="text-slate-500">No records yet.</p> : Object.entries(block.data).map(([category, amount]) => <div key={category} className="flex items-center justify-between"><span className="text-slate-600">{category}</span><span className="font-medium text-slate-900">{formatCurrency(amount)}</span></div>)}</div></div>)}</div></div></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">Bookkeeping records</h2><div className="flex flex-wrap gap-2"><button type="button" onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Download CSV</button><button type="button" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"><ReceiptText className="h-4 w-4" />Download monthly report</button></div></div>
      {records.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">No bookkeeping records yet. Use the form above to add your first income or expense entry.</div> : <><div className="mt-4 hidden overflow-x-auto lg:block"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-slate-600"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Receipt status</th><th className="px-3 py-2">Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-slate-100 align-top"><td className="px-3 py-2">{record.date}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs ${record.type === "Income" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{record.type}</span></td><td className="px-3 py-2">{record.category}</td><td className="px-3 py-2 text-slate-600">{record.description}</td><td className="px-3 py-2 font-medium">{formatCurrency(record.amount)}</td><td className="px-3 py-2">{record.receiptUrl ? "Attached" : "Missing"}</td><td className="px-3 py-2"><div className="flex gap-2">{record.receiptUrl ? <button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Eye className="h-3.5 w-3.5" />View receipt</button> : null}<button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1"><Pencil className="h-3.5 w-3.5" />Edit</button></div></td></tr>)}</tbody></table></div><div className="mt-4 grid gap-3 lg:hidden">{records.map((record) => <article key={record.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{record.category}</p><span className={`rounded-full px-2 py-1 text-xs ${record.type === "Income" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{record.type}</span></div><p className="mt-1 text-sm text-slate-600">{record.description}</p><p className="mt-2 text-xs text-slate-500">{record.date}</p><div className="mt-3 flex items-center justify-between"><p className="font-semibold text-slate-900">{formatCurrency(record.amount)}</p><p className="text-xs text-slate-600">{record.receiptUrl ? "Attached" : "Missing"}</p></div><div className="mt-3 flex gap-2">{record.receiptUrl ? <button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs"><Eye className="h-3.5 w-3.5" />View receipt</button> : null}<button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs"><Pencil className="h-3.5 w-3.5" />Edit</button></div></article>)}</div></>}</div>
  </section>;
}
