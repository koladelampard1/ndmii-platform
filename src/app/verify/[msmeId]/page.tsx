import QRCode from "qrcode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";

export default async function VerifyPage({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: digital } = await supabase
    .from("digital_ids")
    .select("id,msme_id,ndmii_id,issued_at,status,qr_code_ref,validation_snapshot,msmes(id,msme_id,business_name,owner_name,state,sector,passport_photo_url,verification_status,association_id,flagged,suspended,compliance_tag,enforcement_note)")
    .eq("ndmii_id", msmeId)
    .maybeSingle();

  let msme = digital?.msmes as any;
  let digitalId = digital as any;

  if (!msme) {
    const { data: fallbackMsme } = await supabase
      .from("msmes")
      .select("id,msme_id,business_name,owner_name,state,sector,passport_photo_url,verification_status,association_id,flagged,suspended,compliance_tag,enforcement_note")
      .eq("msme_id", msmeId)
      .maybeSingle();
    msme = fallbackMsme;
  }

  if (!msme) {
    return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-2xl font-bold">Verification not found</h1><p className="mt-2 text-slate-600">No MSME exists for ID {msmeId}.</p></main>;
  }

  const [{ data: association }, { data: tax }, { count: complaints }, { data: manufacturer }, { data: validation }] = await Promise.all([
    supabase.from("associations").select("name").eq("id", msme.association_id ?? "").maybeSingle(),
    supabase.from("tax_profiles").select("tax_category,vat_applicable,compliance_status,outstanding_amount").eq("msme_id", msme.id).maybeSingle(),
    supabase.from("complaints").select("*", { count: "exact", head: true }).eq("msme_id", msme.id).neq("status", "closed"),
    supabase
      .from("manufacturer_profiles")
      .select("id,standards_status,inspection_status,counterfeit_risk_flag,compliance_badge,manufacturer_products(product_name,product_code,verification_status,risk_flag)")
      .eq("msme_id", msme.id)
      .maybeSingle(),
    supabase.from("validation_results").select("nin_status,bvn_status,cac_status,tin_status,confidence_score,validated_at,validation_summary").eq("msme_id", msme.id).maybeSingle(),
  ]);

  const resolvedId = digitalId?.ndmii_id ?? msme.msme_id;
  const verificationUrl = digitalId?.qr_code_ref ?? `https://ndmii.gov.ng/verify/${resolvedId}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">Public MSME Verification</h1>
        <p className="mt-2 text-slate-600">Federal issuer authority: Nigeria Digital MSME Identity Infrastructure Initiative (NDMII).</p>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{msme.business_name}</h2>
              <StatusBadge status={msme.verification_status === "verified" ? "active" : msme.verification_status === "suspended" ? "critical" : "warning"} label={digitalId?.status ?? msme.verification_status} />
            </div>
            <p className="text-sm text-slate-600">Digital ID: <strong>{resolvedId}</strong></p>
            <p className="text-sm">Owner: {msme.owner_name} • {msme.state} • {msme.sector}</p>
            <p className="text-sm">Issuer authority: Federal Ministry program registry • Status: {msme.suspended ? "Suspended" : msme.flagged ? "Flagged" : "Good standing"}</p>

            <div className="grid gap-2 rounded-lg border bg-slate-50 p-3 text-sm md:grid-cols-2">
              <p><strong>CAC:</strong> {validation?.cac_status ?? (digitalId?.validation_snapshot as any)?.cac_status ?? "pending"}</p>
              <p><strong>BVN:</strong> {validation?.bvn_status ?? (digitalId?.validation_snapshot as any)?.bvn_status ?? "pending"}</p>
              <p><strong>NIN:</strong> {validation?.nin_status ?? (digitalId?.validation_snapshot as any)?.nin_status ?? "pending"}</p>
              <p><strong>TIN:</strong> {validation?.tin_status ?? (digitalId?.validation_snapshot as any)?.tin_status ?? "pending"}</p>
              <p><strong>Confidence:</strong> {validation?.confidence_score ?? 0}%</p>
              <p><strong>Validated:</strong> {validation?.validated_at ? new Date(validation.validated_at).toLocaleString() : "pending"}</p>
            </div>
            <p className="text-xs text-slate-600">{validation?.validation_summary ?? "Validation simulation visible once onboarding/reviewer check runs."}</p>
            <p className="text-xs text-slate-600">Association: {association?.name ?? "Unlinked"} • Tax: {tax ? `${tax.tax_category}, ${tax.compliance_status}` : "Not profiled"} • Active complaints: {complaints ?? 0}</p>
            <p className="text-xs text-slate-600">Manufacturer: {manufacturer ? `${manufacturer.standards_status} / badge ${manufacturer.compliance_badge}` : "Not a manufacturer"}</p>
          </div>
          <div className="space-y-2 rounded-xl border bg-slate-50 p-3 text-center">
            {msme.passport_photo_url && <img src={msme.passport_photo_url} alt="Passport" className="mx-auto h-20 w-20 rounded-xl border object-cover" />}
            <img src={qrDataUrl} alt={`QR for ${resolvedId}`} className="mx-auto h-40 w-40" />
            <p className="text-xs text-slate-500">{verificationUrl}</p>
            <p className="text-xs text-slate-500">Issued: {digitalId?.issued_at ? new Date(digitalId.issued_at).toLocaleDateString() : "Fallback registry record"}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
