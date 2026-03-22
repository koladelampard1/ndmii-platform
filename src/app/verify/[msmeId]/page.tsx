import QRCode from "qrcode";
import { supabase } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/dashboard/status-badge";

export default async function VerifyPage({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  const { data: msme } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,state,sector,verification_status,association_id")
    .eq("msme_id", msmeId)
    .maybeSingle();

  if (!msme) {
    return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-2xl font-bold">Verification not found</h1><p className="mt-2 text-slate-600">No MSME exists for ID {msmeId}.</p></main>;
  }

  const [{ data: association }, { data: tax }, { count: complaints }, { data: manufacturer }] = await Promise.all([
    supabase.from("associations").select("name").eq("id", msme.association_id ?? "").maybeSingle(),
    supabase.from("tax_profiles").select("tax_category,vat_applicable,compliance_status").eq("msme_id", msme.id).maybeSingle(),
    supabase.from("complaints").select("*", { count: "exact", head: true }).eq("msme_id", msme.id).eq("status", "open"),
    supabase.from("manufacturer_profiles").select("standards_status").eq("msme_id", msme.id).maybeSingle(),
  ]);

  const verificationUrl = `https://ndmii.gov.ng/verify/${msmeId}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">Public MSME Verification</h1>
      <p className="mt-2 text-slate-600">Identity details for MSME ID: {msmeId}</p>
      <div className="mt-6 grid gap-4 rounded-lg border bg-white p-6 md:grid-cols-[1fr_240px]">
        <div className="space-y-2 text-sm">
          <p><strong>Business:</strong> {msme.business_name}</p>
          <p><strong>Owner/Contact:</strong> {msme.owner_name}</p>
          <p><strong>Verification Status:</strong> <StatusBadge status={msme.verification_status === "verified" ? "active" : "warning"} label={msme.verification_status} /></p>
          <p><strong>Sector:</strong> {msme.sector}</p>
          <p><strong>Association:</strong> {association?.name ?? "Unlinked"}</p>
          <p><strong>State/LGA:</strong> {msme.state}</p>
          <p><strong>Tax Profile:</strong> {tax ? `${tax.tax_category} • VAT ${tax.vat_applicable ? "Applicable" : "Not Applicable"} • ${tax.compliance_status}` : "Not yet profiled"}</p>
          <p><strong>Complaint Indicator:</strong> {complaints ? `${complaints} open complaint(s)` : "No open complaints"}</p>
          <p><strong>Manufacturer Status:</strong> {manufacturer?.standards_status ?? "Not a manufacturer"}</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3 text-center">
          <img src={qrDataUrl} alt={`QR for ${msmeId}`} className="mx-auto h-44 w-44" />
          <p className="mt-3 text-xs text-slate-500">{verificationUrl}</p>
        </div>
      </div>
    </main>
  );
}
