import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-xl border border-rose-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Access Restricted</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">You do not have permission to access this page.</h1>
        <p className="mt-3 text-slate-600">Your current role cannot view the requested route or record. Return to your assigned workspace.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/dashboard" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Go to my dashboard</Link>
          <Link href="/verify" className="rounded border px-4 py-2 text-sm">Open public verification</Link>
        </div>
      </div>
    </main>
  );
}
