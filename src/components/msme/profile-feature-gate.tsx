import Link from "next/link";
import { Lock } from "lucide-react";
import type { ProfileFeatureGate } from "@/lib/profile-completion";

export function ProfileFeatureGateNotice({ gate }: { gate: ProfileFeatureGate }) {
  if (gate.unlocked) return null;
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h1 className="text-xl font-semibold">{gate.label} needs a few more profile details</h1>
          <p className="mt-1 text-sm">{gate.explanation}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-800">Complete these fields</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {gate.missingFields.map((field) => (
              <li key={field.key}>
                <Link href={field.href} className="inline-flex rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                  {field.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/msme/settings" className="mt-4 inline-flex rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900">
            Complete Profile
          </Link>
        </div>
      </div>
    </section>
  );
}

