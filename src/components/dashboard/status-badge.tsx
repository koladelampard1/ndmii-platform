import { cn } from "@/lib/utils";

const styles = {
  active: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

export function StatusBadge({ status, label }: { status: keyof typeof styles; label: string }) {
  return <span className={cn("rounded-full px-2 py-1 text-xs font-medium", styles[status])}>{label}</span>;
}
