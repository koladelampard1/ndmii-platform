import QRCode from "qrcode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";

export default async function VerifyPage({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: msme } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,state,sector,passport_photo_url,verification_status,association_id,flagged,suspended,compliance_tag,enforcement_note")
    .eq("msme_id", msmeId)
    .maybeSingle();

  if (!msme) {
    return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-2xl font-bold">Verification not found</h1><p className="mt-2 text-slate-600">No MSME exists for ID {msmeId}.</p></main>;
  }

  const [{ data: association }, { data: tax }, { count: complaints }, { data: manufacturer }] = await Promise.all([
    supabase.from("associations").select("name").eq("id", msme.association_id ?? "").maybeSingle(),
    supabase.from("tax_profiles").select("tax_category,vat_applicable,compliance_status,outstanding_amount").eq("msme_id", msme.id).maybeSingle(),
    supabase.from("complaints").select("*", { count: "exact", head: true }).eq("msme_id", msme.id).neq("status", "closed"),
    supabase
      .from("manufacturer_profiles")
      .select("id,standards_status,inspection_status,counterfeit_risk_flag,compliance_badge,manufacturer_products(product_name,product_code,verification_status,risk_flag)")
      .eq("msme_id", msme.id)
      .maybeSingle(),
  ]);

  const verificationUrl = `https://ndmii.gov.ng/verify/${msmeId}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold">Public MSME Verification Result</h1>
      <p className="mt-2 text-slate-600">Identity, enforcement, compliance, and traceability status for MSME ID: {msmeId}</p>
      <div className="mt-6 grid gap-4 rounded-xl border bg-white p-6 md:grid-cols-[1fr_260px]">
        <div className="space-y-2 text-sm">
          <p><strong>Business:</strong> {msme.business_name}</p>
          <p><strong>Owner/Contact:</strong> {msme.owner_name}</p>
          <p><strong>Verification Status:</strong> <StatusBadge status={msme.verification_status === "verified" ? "active" : msme.verification_status === "suspended" ? "critical" : "warning"} label={msme.verification_status} /></p>
          <p><strong>Enforcement Status:</strong> {msme.suspended ? "Suspended" : msme.flagged ? "Flagged for review" : "No enforcement flag"}</p>
          <p><strong>Compliance Tag:</strong> {msme.compliance_tag ?? "partially compliant"}</p>
          <p><strong>Sector:</strong> {msme.sector}</p>
          <p><strong>Association:</strong> {association?.name ?? "Unlinked"}</p>
          <p><strong>State/LGA:</strong> {msme.state}</p>
          <p><strong>NRS Tax Profile:</strong> {tax ? `${tax.tax_category} • VAT ${tax.vat_applicable ? "Applicable" : "Not Applicable"} • ${tax.compliance_status} • Outstanding ₦${Number(tax.outstanding_amount).toLocaleString()}` : "Not yet profiled"}</p>
          <p><strong>Complaint Indicator:</strong> {complaints ? `${complaints} active complaint(s)` : "No active complaints"}</p>
          <p><strong>Enforcement Note:</strong> {msme.enforcement_note ?? "No enforcement note"}</p>
          <p><strong>Manufacturer Status:</strong> {manufacturer ? `${manufacturer.standards_status} • Inspection ${manufacturer.inspection_status} • Badge ${manufacturer.compliance_badge} • Risk ${manufacturer.counterfeit_risk_flag ? "ALERT" : "CLEAR"}` : "Not a manufacturer"}</p>
          {!!manufacturer?.manufacturer_products?.length && (
            <div>
              <p><strong>Verified Products:</strong></p>
              <ul className="list-disc pl-5">
                {manufacturer.manufacturer_products.map((product, idx) => (
                  <li key={idx}>{product.product_name} ({product.product_code}) • {product.verification_status} • Risk {product.risk_flag ? "Alert" : "Clear"}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="space-y-3 rounded-lg border bg-slate-50 p-3 text-center">
          {msme.passport_photo_url && <img src={msme.passport_photo_url} alt="Passport" className="mx-auto h-24 w-24 rounded-xl border object-cover" />}
          <img src={qrDataUrl} alt={`QR for ${msmeId}`} className="mx-auto h-40 w-40" />
          <p className="text-xs text-slate-500">{verificationUrl}</p>
        </div>
      </div>
    </main>
  );
}
