import Link from "next/link";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/msme/print-button";
import { getCurrentUserContext } from "@/lib/auth/session";

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
  const qr = await QRCode.toDataURL(verifyUrl);
  const ownerEmail = ctx.email || "Not provided";

  return (
    <section className="space-y-6 pb-6">
      <div className="text-center">
        <p className="text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
          <span className="text-emerald-700">NDMII</span> MSME DIGITAL ID CARD
        </p>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">Verified • Trusted • Empowered</p>
      </div>

      <div className="mx-auto w-full max-w-6xl">
        <article
          id="msme-id-card-canvas"
          className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.12)]"
        >
          <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 px-6 py-6 text-white sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-emerald-200">Federal Republic of Nigeria • NDMII</p>
                <p className="mt-3 text-xl font-bold sm:text-3xl">National Digital MSME Identity Initiative</p>
                <p className="mt-1 text-sm text-emerald-100/90 sm:text-base">Official Business Identity Credential</p>
              </div>
              <span className="rounded-full border border-emerald-200/60 bg-emerald-50/95 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-950 sm:text-sm">
                {profile.verification_status === "verified" ? "Verified" : "In Review"}
              </span>
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div className="min-w-0 space-y-5">
              <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
                <div className="h-52 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {profile.passport_photo_url ? (
                    <img src={profile.passport_photo_url} alt="Passport" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs font-medium text-slate-500">
                      Passport photo unavailable
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Business Name</p>
                    <h1 className="mt-2 text-3xl font-black leading-tight text-slate-900 sm:text-[2.4rem] [overflow-wrap:anywhere]">
                      {profile.business_name || "Not provided"}
                    </h1>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Business Owner Email</p>
                    <p className="mt-1 truncate text-lg font-semibold text-slate-800 sm:text-xl">{ownerEmail}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Business Category</p>
                    <p className="mt-1 text-xl font-bold text-emerald-800">{profile.sector || "Unspecified"}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">MSME ID</p>
                  <p className="mt-1 text-2xl font-black leading-tight text-emerald-800 [overflow-wrap:anywhere]">{profile.msme_id}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
                  <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
                    {profile.verification_status || "pending_review"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Business Category</p>
                  <p className="mt-1 font-semibold text-slate-900">{profile.sector || "Unspecified"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Expiry Date</p>
                  <p className="mt-1 font-semibold text-slate-900">April 2027</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">QR Verification</p>
              <img src={qr} alt="Identity QR" className="mx-auto h-52 w-52 rounded-xl border border-slate-200 bg-white p-3" />
              <p className="text-center text-xs text-slate-600 sm:text-sm">Scan to verify instantly: {verifyUrl}</p>
            </div>
          </div>

          <div className="bg-emerald-900 px-6 py-3 text-center text-sm font-semibold text-emerald-50 sm:text-base">
            This MSME is registered and verified on the NDMII Platform
          </div>
        </article>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-3">
        <PrintButton targetId="msme-id-card-canvas" />
        <Link
          href={`/verify/${profile.msme_id}`}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Open Public Verification
        </Link>
      </div>
    </section>
  );
}
