import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { DigitalIdWorkspace } from "@/components/msme/digital-id-workspace";
import { credentialVerifyPath } from "@/lib/data/credential-trust";
import {
  BUSINESS_IDENTITY_CREDENTIAL_MSME_SELECT,
  getBusinessIdentityCredentialLogoUrl,
  getBusinessIdentityCredentialPassportPhotoUrl,
  type BusinessIdentityCredentialMsme,
} from "@/lib/data/business-identity-credential";

export const metadata = {
  title: "My Business Identity Credential",
};

export default async function IdCardPage() {
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (ctx.role !== "msme") {
    redirect("/dashboard/msme/id-registry");
  }

  const { data: profile } = await supabase
    .from("msmes")
    .select(BUSINESS_IDENTITY_CREDENTIAL_MSME_SELECT)
    .eq("created_by", ctx.appUserId ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BusinessIdentityCredentialMsme>();

  if (!profile) {
    redirect("/access-denied");
  }

  const [{ data: compliance }, { data: digitalId }, { data: association }, businessLogoUrl, passportPhotoUrl] = await Promise.all([
    supabase
      .from("compliance_profiles")
      .select("overall_status")
      .eq("msme_id", profile.id)
      .maybeSingle(),
    supabase
      .from("digital_identity_credentials")
      .select("ndmii_id,status,public_token,qr_code_ref,token_expires_at")
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
    getBusinessIdentityCredentialLogoUrl(supabase, profile),
    getBusinessIdentityCredentialPassportPhotoUrl(supabase, profile),
  ]);

  const verifyUrl = digitalId?.public_token ? credentialVerifyPath(digitalId.public_token) : "/verify";
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
      associationName={association?.name ?? null}
      businessName={profile.business_name || "Not provided"}
      ownerName={profile.owner_name || "Not provided"}
      ownerEmail={profile.contact_email || ctx.email || "Not provided"}
      businessCategory={profile.sector || "Unspecified"}
      businessType={profile.business_type || "Unspecified"}
      cacNumber={profile.cac_number || "Not provided"}
      phoneNumber={profile.contact_phone || "Not provided"}
      businessAddress={profile.address || "Not provided"}
      msmeId={profile.msme_id}
      verificationStatus={digitalId?.status || compliance?.overall_status || profile.verification_status || "pending_review"}
      businessLogoUrl={businessLogoUrl}
      passportPhotoUrl={passportPhotoUrl}
      verifyUrl={verifyUrl}
      qrDataUrl={qr}
    />
  );
}
