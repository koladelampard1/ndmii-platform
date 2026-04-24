import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { DigitalIdWorkspace } from "@/components/msme/digital-id-workspace";

export default async function IdCardPage() {
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (ctx.role !== "msme") {
    redirect("/dashboard/msme/id-registry");
  }

  const { data: profile } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,sector,business_type,contact_email,contact_phone,address,cac_number,passport_photo_url,verification_status")
    .eq("id", ctx.linkedMsmeId ?? "")
    .maybeSingle();

  if (!profile) {
    redirect("/access-denied");
  }

  const { data: compliance } = await supabase
    .from("compliance_profiles")
    .select("overall_status")
    .eq("msme_id", profile.id)
    .maybeSingle();

  const verifyUrl = `https://ndmii.gov.ng/verify/${profile.msme_id}`;
  const qr = await QRCode.toDataURL(verifyUrl, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: "H",
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  return (
    <DigitalIdWorkspace
      businessName={profile.business_name || "Not provided"}
      ownerName={profile.owner_name || "Not provided"}
      ownerEmail={profile.contact_email || ctx.email || "Not provided"}
      businessCategory={profile.sector || "Unspecified"}
      businessType={profile.business_type || "Unspecified"}
      cacNumber={profile.cac_number || "Not provided"}
      phoneNumber={profile.contact_phone || "Not provided"}
      businessAddress={profile.address || "Not provided"}
      msmeId={profile.msme_id}
      verificationStatus={compliance?.overall_status || profile.verification_status || "pending_review"}
      passportPhotoUrl={profile.passport_photo_url}
      verifyUrl={verifyUrl}
      qrDataUrl={qr}
    />
  );
}
