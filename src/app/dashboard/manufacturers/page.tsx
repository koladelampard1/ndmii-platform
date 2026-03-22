import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default async function ManufacturersPage() {
  const { data: manufacturers } = await supabase
    .from("manufacturer_profiles")
    .select("id,product_category,traceability_code,standards_status,inspection_status,counterfeit_risk_flag,compliance_badge,msmes(msme_id,business_name,state)")
    .order("created_at", { ascending: false });

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Manufacturer Traceability Workspace</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {(manufacturers ?? []).map((manufacturer) => (
          <article key={manufacturer.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="font-semibold">{manufacturer.msmes?.business_name}</h2>
            <p className="text-xs text-slate-500">{manufacturer.msmes?.msme_id} • {manufacturer.msmes?.state}</p>
            <p className="mt-2 text-sm">Category: {manufacturer.product_category}</p>
            <p className="text-sm">Compliance badge: {manufacturer.compliance_badge}</p>
            <p className="text-sm">Inspection: {manufacturer.inspection_status} • Counterfeit risk: {manufacturer.counterfeit_risk_flag ? "Alert" : "Clear"}</p>
            <Link href={`/dashboard/manufacturers/${manufacturer.id}`} className="mt-3 inline-block text-sm text-emerald-700 hover:underline">Open manufacturer profile →</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
