import Link from "next/link";
import QRCode from "qrcode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PrintButton } from "@/components/msme/print-button";

export default async function IdCardPage({ searchParams }: { searchParams: Promise<{ msmeId?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: msme } = await supabase
    .from("msmes")
    .select("msme_id,business_name,owner_name,state,sector,verification_status")
    .eq("msme_id", params.msmeId ?? "")
    .maybeSingle();

  const fallback = !msme
    ? await supabase
        .from("msmes")
        .select("msme_id,business_name,owner_name,state,sector,verification_status")
        .eq("verification_status", "verified")
        .limit(1)
        .single()
    : { data: msme };

  const profile = fallback.data;
  if (!profile) {
    return <p className="rounded border bg-white p-6 text-slate-500">No approved MSME found yet.</p>;
  }

  const verifyUrl = `https://ndmii.gov.ng/verify/${profile.msme_id}`;
  const qr = await QRCode.toDataURL(verifyUrl);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Digital MSME Identity Card</h1>
      <div className="rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-xl print:bg-white print:text-slate-900">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Federal Republic of Nigeria • NDMII</p>
        <h2 className="mt-2 text-2xl font-bold">{profile.business_name}</h2>
        <p className="text-sm text-slate-200">Owner/Contact: {profile.owner_name}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <p><span className="text-slate-300">MSME ID:</span> {profile.msme_id}</p>
          <p><span className="text-slate-300">Sector:</span> {profile.sector}</p>
          <p><span className="text-slate-300">State/LGA:</span> {profile.state}</p>
          <p><span className="text-slate-300">Status:</span> <StatusBadge status="active" label={profile.verification_status} /></p>
        </div>
        <div className="mt-4 rounded-lg bg-white p-3 text-center text-slate-900">
          <img src={qr} alt="Identity QR" className="mx-auto h-36 w-36" />
          <p className="mt-2 text-xs">Scan to verify: {verifyUrl}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <PrintButton />
        <Link href={`/verify/${profile.msme_id}`} className="rounded border px-4 py-2 text-sm">Open Public Verification</Link>
      </div>
    </section>
  );
}
