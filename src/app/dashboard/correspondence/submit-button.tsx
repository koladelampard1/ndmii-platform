"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function CorrespondenceSubmitButton({ children, pendingLabel = "Processing..." }: { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-wait disabled:opacity-75">
      {pending ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/45 border-r-white" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
