import Link from "next/link";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { getCurrentUserContext } from "@/lib/auth/session";
import { PassportPhoto } from "@/components/msme/passport-photo";

export default async function IdCardDetailPage({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  const ctx = await getCurrentUserContext();

  if (ctx.role !== "admin") {
    redirect("/access-denied");
  }

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,state,sector,passport_photo_url,verification_status,issued_at")
    .eq("msme_id", msmeId)
    .maybeSingle();

  if (!profile) {
    return <p className="rounded border bg-white p-6 text-slate-500">No approved MSME found for {msmeId}.</p>;
  }

  const verifyUrl = `https://bin.gov.ng/verify/${profile.msme_id}`;
  const qr = await QRCode.toDataURL(verifyUrl);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Business Identity Credential Detail</h1>
        <Link href="/dashboard/msme/id-registry" className="rounded border px-3 py-2 text-sm">Back to registry</Link>
      </div>
      <div className="rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Business Identity Network • BIN</p>
        <div className="mt-4 flex items-start gap-4">
          <PassportPhoto
            src={profile.passport_photo_url}
            alt="Passport"
            className="h-24 w-24 rounded-xl border border-white/40 object-cover"
            placeholderClassName="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-white/40 text-xs"
            placeholderText="No photo"
          />
          <div>
            <h2 className="text-2xl font-bold">{profile.business_name}</h2>
            <p className="text-sm text-slate-200">Owner/Contact: {profile.owner_name}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <p><span className="text-slate-300">MSME ID:</span> {profile.msme_id}</p>
          <p><span className="text-slate-300">Sector:</span> {profile.sector}</p>
          <p><span className="text-slate-300">State/LGA:</span> {profile.state}</p>
          <p><span className="text-slate-300">Status:</span> <StatusBadge status="active" label={profile.verification_status} /></p>
          <p><span className="text-slate-300">Issued:</span> {profile.issued_at ? new Date(profile.issued_at).toLocaleDateString() : "Pending"}</p>
        </div>
        <div className="mt-4 rounded-lg bg-white p-3 text-center text-slate-900">
          <img src={qr} alt="Identity QR" className="mx-auto h-36 w-36" />
          <p className="mt-2 text-xs">Scan to verify: {verifyUrl}</p>
        </div>
      </div>
    </section>
  );
}
