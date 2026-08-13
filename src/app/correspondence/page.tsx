import Link from "next/link";
import { ShieldCheck, FileCheck2, Send, QrCode } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TRUST_SIGNALS: [LucideIcon, string, string][] = [
  [FileCheck2, "Reference governed", "Every record receives a non-recycled LCDBO reference."],
  [ShieldCheck, "Approvals recorded", "Review and approval actions are preserved before signature."],
  [Send, "Dispatch tracked", "Official issue requires a dispatch record and tracking number."],
  [QrCode, "Public verification", "Recipients can confirm the public status without seeing private records."],
];

export default function CorrespondencePublicPage() {
  return (
    <main className="min-h-screen bg-[#f8faf5] text-slate-950">
      <section className="bg-[#062f2b] px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">LCDBO Correspondence Management</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">Verify official LCDBO correspondence with confidence.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-50/85">Official LCDBO letters carry a governed reference, approval trail, protected signature event, dispatch record and public verification token.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/correspondence/verify" className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-black text-emerald-950">Verify a letter</Link>
            <Link href="/login?workspace=correspondence&next=%2Fdashboard%2Fcorrespondence" className="rounded-xl border border-white/25 px-5 py-3 text-sm font-black text-white">Open workspace</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-14 md:grid-cols-4">
        {TRUST_SIGNALS.map(([Icon, title, body]) => (
          <article key={String(title)} className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <Icon className="h-6 w-6 text-emerald-700" />
            <h2 className="mt-4 font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
