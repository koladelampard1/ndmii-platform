import Link from "next/link";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { DigitalIdWorkspace } from "@/components/msme/digital-id-workspace";
import { credentialVerifyUrl, publicAppUrl } from "@/lib/data/credential-trust";
import { classifyPassportPhotoValue, logPassportPhotoDiagnostic } from "@/lib/msme/passport-photo-diagnostics";
import {
  BUSINESS_IDENTITY_CREDENTIAL_MSME_SELECT,
  getBusinessIdentityCredentialLogoUrl,
  getBusinessIdentityCredentialPassportPhotoUrl,
  type BusinessIdentityCredentialMsme,
} from "@/lib/data/business-identity-credential";

export default async function IdCardDetailPage({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  const route = "/dashboard/msme/id-card/[msmeId]";
  const ctx = await getCurrentUserContext();

  if (ctx.role !== "admin") {
    redirect("/access-denied");
  }

  const supabase = await createServiceRoleSupabaseClient();
  const { data: profile } = await supabase
    .from("msmes")
    .select(BUSINESS_IDENTITY_CREDENTIAL_MSME_SELECT)
    .eq("msme_id", msmeId)
    .maybeSingle<BusinessIdentityCredentialMsme>();

  if (!profile) {
    return <p className="rounded border bg-white p-6 text-slate-500">No approved MSME found for {msmeId}.</p>;
  }

  const [{ data: digitalId }, { data: association }, businessLogoUrl, passportPhotoUrl] = await Promise.all([
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
    getBusinessIdentityCredentialPassportPhotoUrl(supabase, profile, route),
  ]);

  logPassportPhotoDiagnostic("route", {
    route,
    msmeId: profile.id,
    persistedColumn: profile.passport_photo_path ? "passport_photo_path" : profile.passport_photo_url ? "passport_photo_url" : "none",
    hasPassportPath: Boolean(profile.passport_photo_path?.trim()),
    hasPassportValue: Boolean(profile.passport_photo_path?.trim() || profile.passport_photo_url?.trim()),
    valueType: classifyPassportPhotoValue(profile.passport_photo_path ?? profile.passport_photo_url),
    signedUrlGenerated: Boolean(passportPhotoUrl),
    passportPhotoUrlPassed: Boolean(passportPhotoUrl),
    renderFallback: !passportPhotoUrl,
    supabaseError: null,
  });

  const requestHeaders = await headers();
  const hasCredentialToken = Boolean(digitalId?.public_token);
  const verifyUrl = digitalId?.public_token ? credentialVerifyUrl(digitalId.public_token, { requestHeaders }) : publicAppUrl("/verify", { requestHeaders });
  const qr = await QRCode.toDataURL(verifyUrl);
  console.info("[business-identity-qr][generated]", {
    route,
    verifyUrlIsAbsolute: /^https?:\/\//.test(verifyUrl),
    hasCredentialToken,
    qrGenerated: Boolean(qr),
  });

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
        msmeRowId={profile.id}
        verificationStatus={digitalId?.status || profile.verification_status || "pending_review"}
        businessLogoUrl={businessLogoUrl}
        passportPhotoUrl={passportPhotoUrl}
        verifyUrl={verifyUrl}
        qrDataUrl={qr}
      />
    </section>
  );
}
