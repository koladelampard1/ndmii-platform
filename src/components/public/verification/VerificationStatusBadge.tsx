import { BadgeCheck } from "lucide-react";

type VerificationStatusBadgeProps = {
  title?: string;
  description: string;
};

export function VerificationStatusBadge({ title = "VERIFIED", description }: VerificationStatusBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold tracking-wide text-emerald-700">
        <BadgeCheck className="h-4 w-4" />
        {title}
      </span>
      <p className="text-sm font-medium text-emerald-900">{description}</p>
    </div>
  );
}
