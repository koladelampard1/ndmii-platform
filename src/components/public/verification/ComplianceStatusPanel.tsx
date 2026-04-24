type ComplianceItem = {
  label: string;
  value: string;
};

type ComplianceStatusPanelProps = {
  items: ComplianceItem[];
};

const toneClasses: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  "not available": "bg-slate-100 text-slate-600 border-slate-200",
  unlinked: "bg-slate-100 text-slate-600 border-slate-200",
};

export function ComplianceStatusPanel({ items }: ComplianceStatusPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Compliance Status</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const tone = toneClasses[item.value.toLowerCase()] ?? toneClasses.pending;

          return (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <dt className="text-sm font-medium text-slate-600">{item.label}</dt>
              <dd>
                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{item.value}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
