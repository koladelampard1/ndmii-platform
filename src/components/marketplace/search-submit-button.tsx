"use client";

import { useFormStatus } from "react-dom";
import { Search } from "lucide-react";

export function SearchSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-live="polite"
      aria-busy={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
      disabled={pending}
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      {pending ? "Searching..." : "Search"}
    </button>
  );
}
