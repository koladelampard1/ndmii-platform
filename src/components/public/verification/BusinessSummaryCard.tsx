type BusinessSummaryCardProps = {
  businessName: string;
  businessId: string;
  registryStatus: string;
  jurisdiction: string;
  category: string;
};

const items = [
  { label: "Business Identity Number (BIN ID)", key: "businessId" },
  { label: "Registry Status", key: "registryStatus" },
  { label: "Jurisdiction", key: "jurisdiction" },
  { label: "Sector Category", key: "category" },
] as const;

export function BusinessSummaryCard({ businessName, businessId, registryStatus, jurisdiction, category }: BusinessSummaryCardProps) {
  const values = { businessId, registryStatus, jurisdiction, category };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">{businessName}</h2>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
            <dd className="mt-1 break-words text-base font-medium text-slate-800">{values[item.key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
