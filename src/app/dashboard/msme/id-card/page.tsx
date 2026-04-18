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
    .select("id,msme_id,business_name,state,sector,passport_photo_url,verification_status")
    .eq("id", ctx.linkedMsmeId ?? "")
    .maybeSingle();

  if (!profile) {
    redirect("/access-denied");
  }

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
      ownerEmail={ctx.email || "Not provided"}
      businessCategory={profile.sector || "Unspecified"}
      msmeId={profile.msme_id}
      verificationStatus={profile.verification_status || "pending_review"}
      passportPhotoUrl={profile.passport_photo_url}
      verifyUrl={verifyUrl}
      qrDataUrl={qr}
    />
  );
}
