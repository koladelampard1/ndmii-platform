"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export function ProfileCompletionWelcome({ percentage }: { percentage: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || percentage === 100) return null;
  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-950 to-emerald-800 p-5 text-white shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Welcome to DBIN</p>
          <h2 className="mt-1 text-2xl font-semibold">You can start using the platform immediately.</h2>
          <p className="mt-3 text-sm text-emerald-100">Your profile is {percentage}% complete. Complete it gradually to unlock more opportunities.</p>
        </div>
        <button type="button" onClick={() => setDismissed(true)} className="rounded-full p-1 text-emerald-100 hover:bg-emerald-700" aria-label="Remind me later">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-emerald-50 sm:grid-cols-2 lg:grid-cols-4">
        {["Verification", "Funding opportunities", "Digital Identity", "Marketplace visibility"].map((benefit) => (
          <p key={benefit} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" />{benefit}</p>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/dashboard/msme/settings" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">Complete Profile</Link>
        <button type="button" onClick={() => setDismissed(true)} className="rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Remind Me Later</button>
      </div>
    </section>
  );
}

