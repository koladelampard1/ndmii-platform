import { redirect } from "next/navigation";
import { logActivity } from "@/lib/data/operations";
import { supabase } from "@/lib/supabase/client";

type ManufacturerMsme = {
  msme_id: string | null;
  business_name: string | null;
  owner_name: string | null;
  state: string | null;
  sector: string | null;
};

type ManufacturerProfile = {
  id: string;
  product_category: string | null;
  traceability_code: string | null;
  standards_status: string | null;
  inspection_status: string | null;
  counterfeit_risk_flag: boolean | null;
  compliance_badge: string | null;
  msmes: ManufacturerMsme | null;
};

type ManufacturerProduct = {
  product_name: string | null;
  product_code: string | null;
  verification_status: string | null;
  risk_flag: boolean | null;
};

async function manufacturerAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const kind = String(formData.get("kind"));

  if (kind === "inspection_passed") {
    await supabase.from("manufacturer_profiles").update({ inspection_status: "passed", standards_status: "compliant" }).eq("id", id);
    await logActivity("manufacturer_inspection_passed", "manufacturer", id, {});
  }
  if (kind === "inspection_failed") {
    await supabase.from("manufacturer_profiles").update({ inspection_status: "failed", standards_status: "non_compliant" }).eq("id", id);
    await logActivity("manufacturer_inspection_failed", "manufacturer", id, {});
  }
  if (kind === "raise_alert") {
    await supabase.from("manufacturer_profiles").update({ counterfeit_risk_flag: true }).eq("id", id);
    await supabase.from("manufacturer_products").update({ risk_flag: true }).eq("manufacturer_id", id);
    await logActivity("manufacturer_counterfeit_alert", "manufacturer", id, {});
  }
  if (kind === "clear_alert") {
    await supabase.from("manufacturer_profiles").update({ counterfeit_risk_flag: false }).eq("id", id);
    await supabase.from("manufacturer_products").update({ risk_flag: false }).eq("manufacturer_id", id);
    await logActivity("manufacturer_counterfeit_clear", "manufacturer", id, {});
  }

  redirect(`/dashboard/manufacturers/${id}?saved=1`);
}

export default async function ManufacturerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const { data: manufacturer } = await supabase
    .from("manufacturer_profiles")
    .select("id,product_category,traceability_code,standards_status,inspection_status,counterfeit_risk_flag,compliance_badge,msmes(msme_id,business_name,owner_name,state,sector)")
    .eq("id", id)
    .maybeSingle<ManufacturerProfile>();

  if (!manufacturer) return <div className="rounded border bg-white p-6">Manufacturer profile not found.</div>;
  const { data: productsData } = await supabase
    .from("manufacturer_products")
    .select("product_name,product_code,verification_status,risk_flag")
    .eq("manufacturer_id", id);
  const products = (productsData ?? []) as ManufacturerProduct[];

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Manufacturer Detail & Product Verification</h1>
      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Manufacturer action logged.</p>}
      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">{manufacturer.msmes?.business_name}</h2>
        <p className="text-xs text-slate-500">{manufacturer.msmes?.msme_id} • {manufacturer.msmes?.state} • {manufacturer.msmes?.sector}</p>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <p><strong>Company details:</strong> {manufacturer.msmes?.owner_name}</p>
          <p><strong>Compliance badge:</strong> {manufacturer.compliance_badge}</p>
          <p><strong>Product lines:</strong> {manufacturer.product_category}</p>
          <p><strong>Inspection status:</strong> {manufacturer.inspection_status}</p>
          <p><strong>Counterfeit risk flag:</strong> {manufacturer.counterfeit_risk_flag ? "Raised" : "Clear"}</p>
          <p><strong>Traceability code:</strong> {manufacturer.traceability_code}</p>
        </div>
      </article>
      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
        {[
          ["inspection_passed", "Mark inspection passed"],
          ["inspection_failed", "Mark inspection failed"],
          ["raise_alert", "Raise counterfeit alert"],
          ["clear_alert", "Clear counterfeit alert"],
        ].map(([kind, label]) => (
          <form action={manufacturerAction} key={kind}><input type="hidden" name="id" value={manufacturer.id} /><input type="hidden" name="kind" value={kind} /><button className="w-full rounded border bg-slate-900 px-3 py-2 text-xs text-white">{label}</button></form>
        ))}
      </div>
      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Product records</h2>
        <div className="mt-2 space-y-2 text-sm">
          {(products ?? []).length === 0 && <p className="text-slate-500">No product records yet.</p>}
          {(products ?? []).map((product, idx) => <div key={idx} className="rounded border p-2">{product.product_name} ({product.product_code}) • {product.verification_status} • risk: {product.risk_flag ? "alert" : "clear"}</div>)}
        </div>
      </article>
    </section>
  );
}
