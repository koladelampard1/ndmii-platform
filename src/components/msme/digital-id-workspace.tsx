"use client";

import { useCallback, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, Download, Globe2, LockKeyhole, Share2, ShieldCheck } from "lucide-react";
import { PassportPhoto } from "@/components/msme/passport-photo";

type DigitalIdWorkspaceProps = {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  businessCategory: string;
  businessType: string;
  cacNumber: string;
  phoneNumber: string;
  businessAddress: string;
  msmeId: string;
  verificationStatus: string;
  passportPhotoUrl?: string | null;
  verifyUrl: string;
  qrDataUrl: string;
};

function formatStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DigitalIdWorkspace({
  businessName,
  ownerName,
  ownerEmail,
  businessCategory,
  businessType,
  cacNumber,
  phoneNumber,
  businessAddress,
  msmeId,
  verificationStatus,
  passportPhotoUrl,
  verifyUrl,
  qrDataUrl,
}: DigitalIdWorkspaceProps) {
  const [busy, setBusy] = useState<"none" | "png" | "share">("none");

  const displayStatus = useMemo(() => formatStatus(verificationStatus || "pending_review"), [verificationStatus]);
  const isVerified = useMemo(() => displayStatus.toLowerCase() === "verified", [displayStatus]);
  const expiryDate = "April 2027";

  const shareCard = useCallback(async () => {
    setBusy("share");
    try {
      if (navigator.share) {
        await navigator.share({
          title: "NDMII MSME Digital ID",
          text: `Verify MSME identity: ${msmeId}`,
          url: verifyUrl,
        });
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(verifyUrl);
      }
    } finally {
      setBusy("none");
    }
  }, [msmeId, verifyUrl]);

  const downloadCredential = useCallback(async () => {
    setBusy("png");
    try {
      const canvas = document.createElement("canvas");
      const width = 1800;
      const height = 1140;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#063C2E");
      gradient.addColorStop(1, "#0A5F47");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 16; i += 1) {
        ctx.strokeStyle = `rgba(110,231,183,${0.08 - i * 0.004})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 60 + i * 70);
        ctx.bezierCurveTo(width * 0.3, 30 + i * 55, width * 0.7, 100 + i * 58, width, 70 + i * 60);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 26px Inter, Arial";
      ctx.fillText("FEDERAL REPUBLIC OF NIGERIA", 70, 92);
      ctx.font = "700 62px Inter, Arial";
      ctx.fillText("National Digital MSME Identity Initiative", 70, 164);
      ctx.font = "500 44px Inter, Arial";
      ctx.fillText("Official Business Identity Credential", 70, 220);

      ctx.font = "800 80px Inter, Arial";
      ctx.textAlign = "right";
      ctx.fillText("NDMII", width - 70, 164);
      ctx.font = "600 30px Inter, Arial";
      ctx.fillText("Verified • Trusted • Empowered", width - 70, 214);
      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillRect(70, 280, width - 140, height - 520);

      const qrImage = new Image();
      await new Promise<void>((resolve) => {
        qrImage.onload = () => resolve();
        qrImage.src = qrDataUrl;
      });
      ctx.drawImage(qrImage, 94, height - 216, 120, 120);

      ctx.fillStyle = "#0f172a";
      ctx.font = "700 28px Inter, Arial";
      ctx.fillText("SCAN TO VERIFY", 238, height - 150);
      ctx.font = "500 26px Inter, Arial";
      ctx.fillText("Instantly verify this MSME identity on the NDMII portal", 238, height - 112);

      ctx.font = "700 28px Inter, Arial";
      ctx.fillText("MSME ID", 760, height - 150);
      ctx.font = "800 48px Inter, Arial";
      ctx.fillText(msmeId, 760, height - 94);

      ctx.font = "700 28px Inter, Arial";
      ctx.fillText("STATUS", 1240, height - 150);
      ctx.font = "700 40px Inter, Arial";
      ctx.fillStyle = isVerified ? "#15803d" : "#ca8a04";
      ctx.fillText(isVerified ? "Verified" : "Pending Review", 1240, height - 98);

      ctx.fillStyle = "#0f172a";
      ctx.font = "700 28px Inter, Arial";
      ctx.fillText("EXPIRY DATE", 1510, height - 150);
      ctx.font = "700 46px Inter, Arial";
      ctx.fillText(expiryDate, 1510, height - 94);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) return;
      downloadBlob(blob, `${msmeId.toLowerCase()}-digital-credential.png`);
    } finally {
      setBusy("none");
    }
  }, [expiryDate, isVerified, msmeId, qrDataUrl]);

  return (
    <section className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">{isVerified ? "Verified MSME" : "Pending MSME"}</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Official Business Identity Credential</h1>
        </div>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          <button
            type="button"
            onClick={shareCard}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" /> {busy === "share" ? "Sharing..." : "Share ID Card"}
          </button>
          <button
            type="button"
            onClick={downloadCredential}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {busy === "png" ? "Preparing..." : "Download Credential"}
          </button>
        </div>
      </header>

      <article className="relative overflow-hidden rounded-2xl border border-emerald-300/20 bg-[linear-gradient(135deg,#063C2E,#0A5F47)] p-4 shadow-2xl ring-1 ring-white/20 sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-10 [background:repeating-linear-gradient(135deg,rgba(255,255,255,.14)_0_2px,transparent_2px_16px)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_80%_22%,#fff_0,transparent_38%),radial-gradient(circle_at_88%_78%,#fff_0,transparent_26%)]" />
        <div className="pointer-events-none absolute bottom-6 right-6 h-28 w-28 rounded-full border border-emerald-100/20 bg-white/5 sm:h-44 sm:w-44" />
        <div className="pointer-events-none absolute right-7 top-7 text-right text-emerald-100/90">
          <p className="text-3xl font-black leading-none sm:text-6xl">NDMII</p>
          <p className="mt-1 text-[10px] sm:text-sm">Verified • Trusted • Empowered</p>
        </div>

        <div className="pointer-events-none absolute bottom-8 right-6 hidden text-emerald-100/10 sm:block">
          <svg viewBox="0 0 200 200" className="h-32 w-32">
            <path d="M52 25l25 7 18-5 12 11 18-2 11 18 20 16-9 20 6 23-18 15-9 18-24-2-17 15-20-7-22 8-16-17-23-3-8-20-20-16 7-20-7-22 20-16 7-22 23-1 17-14z" fill="currentColor" />
          </svg>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-white/20 pb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-100">Federal Republic of Nigeria</p>
              <h2 className="mt-1 text-xl font-semibold text-white sm:text-5xl">National Digital MSME Identity Initiative</h2>
              <p className="mt-1 text-sm text-emerald-50 sm:text-2xl">Official Business Identity Credential</p>
            </div>
            <span className={`mt-1 inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur ${isVerified ? "border-emerald-100/60 bg-emerald-300/20 text-emerald-50 shadow-[0_0_24px_rgba(74,222,128,.55)]" : "border-amber-100/60 bg-amber-300/20 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,.45)]"}`}>
              {isVerified ? "Verified" : "Pending Review"}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-emerald-100/40 bg-black/20 p-1 backdrop-blur-sm">
                <PassportPhoto
                  src={passportPhotoUrl}
                  alt="Passport photo"
                  className="h-72 w-full rounded-xl object-cover"
                  placeholderClassName="flex h-72 flex-col items-center justify-center rounded-xl bg-black/30 text-emerald-100"
                  placeholderText="Passport photo unavailable"
                />
              </div>
              <div className="rounded-xl border border-emerald-200/30 bg-black/20 p-3 text-emerald-50/95 backdrop-blur-sm">
                <p className="font-signature text-xl italic leading-tight">Authorized Signature</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-emerald-100/80">Authorized Business Representative</p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200/30 bg-black/15 p-4 backdrop-blur-sm sm:p-6">
              <p className="text-xs text-emerald-100/80">Business Name</p>
              <p className="text-2xl font-semibold text-white">{businessName || "Not provided"}</p>

              <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-4 text-emerald-50 sm:grid-cols-2">
                <div><p className="text-xs text-emerald-100/80">Owner Name</p><p className="text-base font-medium">{ownerName || "Not provided"}</p></div>
                <div><p className="text-xs text-emerald-100/80">Email</p><p className="text-base font-medium [overflow-wrap:anywhere]">{ownerEmail || "Not provided"}</p></div>
                <div><p className="text-xs text-emerald-100/80">Business Category</p><p className="text-base font-medium">{businessCategory || "Unspecified"}</p></div>
                <div><p className="text-xs text-emerald-100/80">Business Type</p><p className="text-base font-medium">{businessType || "Unspecified"}</p></div>
                <div><p className="text-xs text-emerald-100/80">CAC Number</p><p className="text-base font-medium">{cacNumber || "Not provided"}</p></div>
                <div><p className="text-xs text-emerald-100/80">Phone Number</p><p className="text-base font-medium">{phoneNumber || "Not provided"}</p></div>
                <div className="sm:col-span-2"><p className="text-xs text-emerald-100/80">Business Address</p><p className="text-base font-medium">{businessAddress || "Not provided"}</p></div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-emerald-200/35 bg-black/20 p-4 backdrop-blur sm:grid-cols-1 md:grid-cols-[1.2fr_1fr_0.9fr_0.7fr] md:items-center">
            <div className="flex items-center gap-3 border-emerald-100/25 md:border-r md:pr-4">
              <div className="rounded-lg bg-white p-1.5">
                <img src={qrDataUrl} alt="Verification QR" className="h-20 w-20" />
              </div>
              <div className="text-emerald-50">
                <p className="text-xs uppercase tracking-widest text-emerald-100">Scan to Verify</p>
                <p className="text-sm">Instantly verify this MSME identity on the NDMII portal</p>
              </div>
            </div>
            <div className="md:border-r md:border-emerald-100/25 md:pr-4">
              <p className="text-xs uppercase tracking-widest text-emerald-100">MSME ID</p>
              <p className="text-2xl font-semibold text-white">{msmeId}</p>
            </div>
            <div className="md:border-r md:border-emerald-100/25 md:pr-4">
              <p className="text-xs uppercase tracking-widest text-emerald-100">Status</p>
              <p className={`text-xl font-semibold ${isVerified ? "text-emerald-200" : "text-amber-200"}`}>{displayStatus}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-100">Expiry Date</p>
              <p className="text-2xl font-semibold text-white">{expiryDate}</p>
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-emerald-700" /> Government Recognised</p>
          <p className="mt-2 text-sm text-slate-600">Issued under the Federal Republic of Nigeria digital identity framework.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><LockKeyhole className="h-4 w-4 text-emerald-700" /> Secure &amp; Tamper-Proof</p>
          <p className="mt-2 text-sm text-slate-600">Encrypted metadata and QR verification ensure authenticity.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><Globe2 className="h-4 w-4 text-emerald-700" /> Globally Shareable</p>
          <p className="mt-2 text-sm text-slate-600">Share your verified MSME identity with confidence anywhere.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><BadgeCheck className="h-4 w-4 text-emerald-700" /> Trusted &amp; Verified</p>
          <p className="mt-2 text-sm text-slate-600">NDMII verified MSMEs are trusted by partners and institutions.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="inline-flex items-center gap-2 font-medium text-slate-800"><CheckCircle2 className="h-4 w-4 text-emerald-700" /> This credential is an official identity artifact of the National Digital MSME Identity Initiative.</p>
      </div>
    </section>
  );
}
