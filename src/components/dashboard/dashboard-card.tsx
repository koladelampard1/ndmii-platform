import Link from "next/link";

type DashboardCardProps = {
  title: string;
  value: string;
  definition: string;
  href?: string;
  unavailable?: boolean;
};

export function DashboardCard({ title, value, definition, href, unavailable }: DashboardCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600" title={definition}>{title}</p>
        {unavailable ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">Not yet available</span>
        ) : href ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Open</span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{definition}</p>
    </>
  );

  if (href && !unavailable) {
    return (
      <Link href={href} className="block rounded-lg border bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      {content}
    </div>
  );
}
