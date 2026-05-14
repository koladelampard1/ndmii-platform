import Link from "next/link";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { DigitalIdWorkspace } from "@/components/msme/digital-id-workspace";

export default async function IdCardDetailPage({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  const ctx = await getCurrentUserContext();

  if (ctx.role !== "admin") {
    redirect("/access-denied");
  }

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,sector,business_type,contact_email,contact_phone,address,cac_number,passport_photo_url,verification_status,association_id")
    .eq("msme_id", msmeId)
    .maybeSingle();

  if (!profile) {
    return <p className="rounded border bg-white p-6 text-slate-500">No approved MSME found for {msmeId}.</p>;
  }

  const [{ data: digitalId }, { data: association }] = await Promise.all([
    supabase
      .from("digital_ids")
      .select("ndmii_id")
      .eq("msme_id", profile.id)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    profile.association_id
      ? supabase
          .from("associations")
          .select("name")
          .eq("id", profile.association_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const verificationId = digitalId?.ndmii_id || profile.msme_id;
  const verifyUrl = `/verify/${encodeURIComponent(verificationId)}`;
  const qr = await QRCode.toDataURL(verifyUrl);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Business Identity Credential Detail</h1>
        <Link href="/dashboard/msme/id-registry" className="rounded border px-3 py-2 text-sm">Back to registry</Link>
      </div>
      <DigitalIdWorkspace
        associationName={association?.name ?? null}
        businessName={profile.business_name || "Not provided"}
        ownerName={profile.owner_name || "Not provided"}
        ownerEmail={profile.contact_email || "Not provided"}
        businessCategory={profile.sector || "Unspecified"}
        businessType={profile.business_type || "Unspecified"}
        cacNumber={profile.cac_number || "Not provided"}
        phoneNumber={profile.contact_phone || "Not provided"}
        businessAddress={profile.address || "Not provided"}
        msmeId={profile.msme_id}
        verificationStatus={profile.verification_status || "pending_review"}
        passportPhotoUrl={profile.passport_photo_url}
        verifyUrl={verifyUrl}
        qrDataUrl={qr}
      />
    </section>
  );
}
