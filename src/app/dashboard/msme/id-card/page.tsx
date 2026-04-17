import Link from "next/link";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";
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
    .select("id,msme_id,business_name,owner_name,state,sector,passport_photo_url,verification_status")
    .eq("id", ctx.linkedMsmeId ?? "")
    .maybeSingle();

  if (!profile) {
    redirect("/access-denied");
  }

  const verifyUrl = `https://ndmii.gov.ng/verify/${profile.msme_id}`;
  const qr = await QRCode.toDataURL(verifyUrl);

  return (
    <section className="space-y-6 pb-4">
      <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-b from-white via-slate-50/80 to-white p-4 shadow-sm sm:p-6">
        <div className="text-center">
          <p className="text-xl font-black tracking-tight text-slate-900 sm:text-3xl">
            <span className="text-emerald-700">NDMII</span> MSME DIGITAL ID CARD
          </p>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">Verified • Trusted • Empowered</p>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <article className="overflow-hidden rounded-3xl border border-emerald-200/40 bg-white shadow-xl shadow-emerald-950/10">
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">Federal Republic of Nigeria • NDMII</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">National Digital MSME Identity Initiative</p>
                  <p className="mt-1 text-xs text-emerald-100/90">Official Business Identity Credential</p>
                </div>
                <span className="rounded-full border border-emerald-200/60 bg-emerald-50/95 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900">
                  {profile.verification_status === "verified" ? "Verified" : "In Review"}
                </span>
              </div>
            </div>

            <div className="space-y-5 bg-white p-5">
              <div className="grid gap-4 sm:grid-cols-[144px_1fr]">
                <div className="h-44 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {profile.passport_photo_url ? (
                    <img src={profile.passport_photo_url} alt="Passport" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs font-medium text-slate-500">
                      Passport photo unavailable
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Business Name</p>
                    <h1 className="mt-1 text-3xl font-extrabold leading-tight text-slate-900">{profile.business_name}</h1>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Business Owner</p>
                    <p className="text-lg font-semibold text-slate-800">{profile.owner_name || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Business Category</p>
                    <p className="text-lg font-semibold text-emerald-800">{profile.sector || "Unspecified"}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">NDMII MSME ID</p>
                  <p className="mt-1 text-2xl font-extrabold text-emerald-800">{profile.msme_id}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</p>
                  <div className="mt-2">
                    <StatusBadge status="active" label={profile.verification_status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">State / LGA</p>
                  <p className="mt-1 font-semibold text-slate-800">{profile.state || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Sector</p>
                  <p className="mt-1 font-semibold text-slate-800">{profile.sector || "Unspecified"}</p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-900 px-5 py-3 text-center text-sm font-semibold text-emerald-50">
              This MSME is registered and verified on the NDMII Platform
            </div>
          </article>

          <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">About this MSME</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {profile.business_name} is registered on the NDMII platform as a {profile.sector?.toLowerCase() || "business"} enterprise in {profile.state || "Nigeria"}.
              </p>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <p className="text-slate-500">Business Owner</p>
                <p className="text-right font-semibold text-slate-900">{profile.owner_name || "Not provided"}</p>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <p className="text-slate-500">Public Verification</p>
                <p className="max-w-[20rem] text-right font-semibold text-slate-900">{verifyUrl}</p>
              </div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-slate-500">Identity Type</p>
                <p className="font-semibold text-slate-900">NDMII Digital MSME Credential</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">QR Verification</p>
              <img src={qr} alt="Identity QR" className="mx-auto mt-3 h-44 w-44 rounded-lg border border-slate-200 bg-white p-2" />
              <p className="mt-3 text-xs text-slate-600">Scan to verify this MSME identity instantly.</p>
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-slate-700">
              <p className="font-semibold text-emerald-900">Important</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>This card is issued for official MSME identity validation.</li>
                <li>Use the QR code or the public verification page for confirmation.</li>
                <li>Report misuse through the platform support channels.</li>
              </ul>
            </div>
          </article>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <PrintButton />
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
