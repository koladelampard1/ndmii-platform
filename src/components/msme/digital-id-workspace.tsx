"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  Calendar,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  HelpCircle,
  Mail,
  QrCode,
  Send,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { PassportPhoto } from "@/components/msme/passport-photo";
import { PrintButton } from "@/components/msme/print-button";

type DigitalIdWorkspaceProps = {
  businessName: string;
  ownerEmail: string;
  businessCategory: string;
  msmeId: string;
  verificationStatus: string;
  passportPhotoUrl?: string | null;
  verifyUrl: string;
  qrDataUrl: string;
};

const ID_RATIO = 1.586;
const EXPORT_WIDTH = 1400;
const EXPORT_HEIGHT = Math.round(EXPORT_WIDTH / ID_RATIO);

function formatStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      return;
    }

    if (current) lines.push(current);
    current = word;
  });

  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  const last = clipped[maxLines - 1] ?? "";
  clipped[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 2))}…`;
  return clipped;
}

async function loadImage(src: string, crossOrigin?: "anonymous") {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    img.src = src;
  });
}

export function DigitalIdWorkspace({
  businessName,
  ownerEmail,
  businessCategory,
  msmeId,
  verificationStatus,
  passportPhotoUrl,
  verifyUrl,
  qrDataUrl,
}: DigitalIdWorkspaceProps) {
  const [busy, setBusy] = useState<"none" | "pdf" | "png" | "share">("none");

  const cardExpiry = "April 2027";
  const displayStatus = useMemo(() => formatStatus(verificationStatus || "pending_review"), [verificationStatus]);

  const drawExportCanvas = useCallback(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_WIDTH;
    canvas.height = EXPORT_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

    const headerHeight = 216;
    const bodyY = headerHeight;
    const footerHeight = 104;

    const gradient = ctx.createLinearGradient(0, 0, EXPORT_WIDTH, 0);
    gradient.addColorStop(0, "#064e3b");
    gradient.addColorStop(0.5, "#065f46");
    gradient.addColorStop(1, "#047857");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, EXPORT_WIDTH, headerHeight);

    ctx.fillStyle = "#a7f3d0";
    ctx.font = "600 20px Inter, Arial, sans-serif";
    ctx.fillText("FEDERAL REPUBLIC OF NIGERIA", 50, 54);

    ctx.fillStyle = "#ecfdf5";
    ctx.font = "700 50px Inter, Arial, sans-serif";
    ctx.fillText("National Digital MSME Identity Initiative", 50, 122);
    ctx.font = "500 30px Inter, Arial, sans-serif";
    ctx.fillText("Official Business Identity Credential", 50, 170);

    ctx.font = "700 56px Inter, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("NDMII", EXPORT_WIDTH - 52, 124);
    ctx.textAlign = "left";
    ctx.font = "600 24px Inter, Arial, sans-serif";
    ctx.fillText("Verified • Trusted • Empowered", EXPORT_WIDTH - 425, 170);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, bodyY, EXPORT_WIDTH, EXPORT_HEIGHT - headerHeight - footerHeight);

    ctx.strokeStyle = "#e2e8f0";
    for (let i = 0; i < 22; i += 1) {
      const y = bodyY + i * 24;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(EXPORT_WIDTH, y + 8);
      ctx.stroke();
    }

    const photoX = 46;
    const photoY = bodyY + 42;
    const photoW = 208;
    const photoH = 276;

    ctx.fillStyle = "#e2e8f0";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    if (passportPhotoUrl) {
      try {
        const passport = await loadImage(passportPhotoUrl, "anonymous");
        ctx.drawImage(passport, photoX, photoY, photoW, photoH);
      } catch {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "700 84px Inter, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("N", photoX + photoW / 2, photoY + photoH / 2 + 28);
        ctx.textAlign = "left";
      }
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 84px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", photoX + photoW / 2, photoY + photoH / 2 + 28);
      ctx.textAlign = "left";
    }

    const centerX = photoX + photoW + 36;
    const centerW = 610;

    ctx.fillStyle = "#64748b";
    ctx.font = "700 18px Inter, Arial, sans-serif";
    ctx.fillText("BUSINESS NAME", centerX, bodyY + 60);

    ctx.fillStyle = "#065f46";
    ctx.font = "700 52px Inter, Arial, sans-serif";
    wrapText(ctx, businessName || "Not provided", centerW, 2).forEach((line, idx) => {
      ctx.fillText(line, centerX, bodyY + 118 + idx * 56);
    });

    ctx.fillStyle = "#64748b";
    ctx.font = "700 18px Inter, Arial, sans-serif";
    ctx.fillText("BUSINESS OWNER EMAIL", centerX, bodyY + 206);

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 38px Inter, Arial, sans-serif";
    wrapText(ctx, ownerEmail || "Not provided", centerW, 1).forEach((line) => {
      ctx.fillText(line, centerX, bodyY + 250);
    });

    ctx.fillStyle = "#64748b";
    ctx.font = "700 18px Inter, Arial, sans-serif";
    ctx.fillText("BUSINESS CATEGORY", centerX, bodyY + 306);
    ctx.fillStyle = "#1e293b";
    ctx.font = "700 36px Inter, Arial, sans-serif";
    ctx.fillText(businessCategory || "Unspecified", centerX, bodyY + 348);

    const qrX = 1010;
    const qrY = bodyY + 80;
    const qrSize = 220;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);
    ctx.strokeStyle = "#d1d5db";
    ctx.strokeRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);
    const qr = await loadImage(qrDataUrl);
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

    ctx.fillStyle = "#64748b";
    ctx.font = "700 18px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("QR VERIFICATION", qrX + qrSize / 2, bodyY + 52);
    ctx.font = "500 19px Inter, Arial, sans-serif";
    ctx.fillText("Scan to verify instantly", qrX + qrSize / 2, bodyY + 342);
    ctx.font = "500 16px Inter, Arial, sans-serif";
    ctx.fillText(verifyUrl, qrX + qrSize / 2, bodyY + 370);
    ctx.textAlign = "left";

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, EXPORT_HEIGHT - footerHeight, EXPORT_WIDTH, footerHeight);
    ctx.strokeStyle = "#d1d5db";
    ctx.beginPath();
    ctx.moveTo(0, EXPORT_HEIGHT - footerHeight);
    ctx.lineTo(EXPORT_WIDTH, EXPORT_HEIGHT - footerHeight);
    ctx.stroke();

    const footerY = EXPORT_HEIGHT - 58;
    ctx.fillStyle = "#64748b";
    ctx.font = "700 17px Inter, Arial, sans-serif";
    ctx.fillText("MSME ID", 48, footerY - 20);
    ctx.fillStyle = "#065f46";
    ctx.font = "700 40px Inter, Arial, sans-serif";
    ctx.fillText(msmeId, 48, footerY + 26);

    ctx.fillStyle = "#64748b";
    ctx.font = "700 17px Inter, Arial, sans-serif";
    ctx.fillText("STATUS", 640, footerY - 20);
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(640, footerY - 6, 126, 42);
    ctx.fillStyle = "#f0fdf4";
    ctx.font = "700 22px Inter, Arial, sans-serif";
    ctx.fillText(displayStatus, 655, footerY + 22);

    ctx.fillStyle = "#64748b";
    ctx.font = "700 17px Inter, Arial, sans-serif";
    ctx.fillText("EXPIRY DATE", 870, footerY - 20);
    ctx.fillStyle = "#065f46";
    ctx.font = "700 36px Inter, Arial, sans-serif";
    ctx.fillText(cardExpiry, 870, footerY + 22);

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(1180, EXPORT_HEIGHT - footerHeight + 14, 180, 74);
    ctx.fillStyle = "#64748b";
    ctx.font = "600 20px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Federal Crest", 1270, EXPORT_HEIGHT - footerHeight + 60);
    ctx.textAlign = "left";

    return canvas;
  }, [businessCategory, businessName, displayStatus, msmeId, ownerEmail, passportPhotoUrl, qrDataUrl, verifyUrl]);

  const openPrintWindow = useCallback(async () => {
    const canvas = await drawExportCanvas();
    const dataUrl = canvas.toDataURL("image/png", 1);

    const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!win) return;

    win.document.write(`<!doctype html>
      <html>
        <head>
          <title>NDMII MSME ID Card</title>
          <style>
            @page { size: A4 portrait; margin: 14mm; }
            body { margin: 0; display: grid; place-items: center; min-height: 100vh; background: #fff; }
            .wrap { width: min(100%, 980px); }
            img { width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <div class="wrap"><img src="${dataUrl}" alt="NDMII ID Card" /></div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>`);
    win.document.close();
  }, [drawExportCanvas]);

  const downloadPng = useCallback(async () => {
    setBusy("png");
    try {
      const canvas = await drawExportCanvas();
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png", 1);
      link.download = `${msmeId.toLowerCase()}-mobile-id-card.png`;
      link.click();
    } finally {
      setBusy("none");
    }
  }, [drawExportCanvas, msmeId]);

  const downloadPdf = useCallback(async () => {
    setBusy("pdf");
    try {
      await openPrintWindow();
    } finally {
      setBusy("none");
    }
  }, [openPrintWindow]);

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
      await navigator.clipboard.writeText(verifyUrl);
    } finally {
      setBusy("none");
    }
  }, [msmeId, verifyUrl]);

  const ActionButton = ({
    title,
    helper,
    icon,
    onClick,
    disabled,
    variant = "secondary",
  }: {
    title: string;
    helper: string;
    icon: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: "primary" | "secondary";
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
        variant === "primary"
          ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${variant === "primary" ? "bg-emerald-600" : "bg-slate-100"}`}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className={`block text-xs ${variant === "primary" ? "text-emerald-100" : "text-slate-500"}`}>{helper}</span>
      </span>
    </button>
  );

  return (
    <section className="space-y-6 pb-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Digital ID Card</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        </div>
        <p className="text-sm text-slate-600">Your official NDMII identity credential. Download and share your digital ID card.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Verified • Trusted • Empowered</p>
            <p className="text-sm text-slate-600">This MSME is registered and verified on the NDMII Platform.</p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-800">
          Learn more about NDMII <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Identity Information</h2>
          <div className="mt-5 space-y-4">
            <div className="flex gap-3"><Building2 className="mt-0.5 h-5 w-5 text-slate-400" /><div><p className="text-xs text-slate-500">Business Name</p><p className="font-semibold text-slate-900">{businessName}</p></div></div>
            <div className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 text-slate-400" /><div><p className="text-xs text-slate-500">Business Owner Email</p><p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{ownerEmail}</p></div></div>
            <div className="flex gap-3"><Tag className="mt-0.5 h-5 w-5 text-slate-400" /><div><p className="text-xs text-slate-500">Business Category</p><p className="font-semibold text-slate-900">{businessCategory}</p></div></div>
            <div className="flex gap-3"><Copy className="mt-0.5 h-5 w-5 text-slate-400" /><div><p className="text-xs text-slate-500">MSME ID</p><p className="font-semibold text-slate-900">{msmeId}</p></div></div>
          </div>

          <hr className="my-5 border-slate-200" />

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-600">Registration Status</span><span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Verified</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Verification Status</span><span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">{displayStatus}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Current Review</span><span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Pending Review</span></div>
          </div>

          <hr className="my-5 border-slate-200" />

          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" />Date Registered</span><span>18 Apr 2025</span></div>
            <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" />Expiry Date</span><span>{cardExpiry}</span></div>
            <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" />Last Updated</span><span>18 Apr 2025, 20:45</span></div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Your Digital ID Card</h2>
            <span className="text-sm font-medium text-slate-500">Valid until {cardExpiry}</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div
              id="msme-id-card-canvas"
              className="relative mx-auto w-full max-w-[1080px] overflow-hidden"
              style={{ aspectRatio: `${ID_RATIO}` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 px-4 py-4 text-white sm:px-6 sm:py-5" style={{ height: "29%" }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200 sm:text-xs">Federal Republic of Nigeria</p>
                <p className="mt-1 text-base font-bold sm:text-2xl">National Digital MSME Identity Initiative</p>
                <p className="text-xs text-emerald-100 sm:text-sm">Official Business Identity Credential</p>
                <div className="absolute right-4 top-4 text-right sm:right-6 sm:top-5">
                  <p className="text-lg font-black tracking-tight sm:text-3xl">NDMII</p>
                  <p className="text-[10px] text-emerald-100 sm:text-xs">Verified • Trusted • Empowered</p>
                </div>
              </div>

              <div className="absolute inset-x-0 px-4 py-3 sm:px-6 sm:py-4" style={{ top: "29%", bottom: "20%", backgroundColor: "#f8fafc" }}>
                <div className="grid h-full grid-cols-[110px_1fr_128px] gap-3 sm:grid-cols-[180px_1fr_200px] sm:gap-5">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <PassportPhoto
                      src={passportPhotoUrl}
                      alt="Passport photo"
                      className="h-full w-full object-cover"
                      placeholderClassName="flex h-full flex-col items-center justify-center bg-slate-200 text-slate-500"
                      placeholderText="N"
                    />
                  </div>
                  <div className="min-w-0 self-center">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500 sm:text-[10px]">Business Name</p>
                    <p className="text-sm font-bold leading-tight text-emerald-900 sm:text-3xl [overflow-wrap:anywhere]">{businessName}</p>
                    <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500 sm:text-[10px]">Business Owner Email</p>
                    <p className="text-[11px] font-semibold text-slate-800 sm:text-lg [overflow-wrap:anywhere]">{ownerEmail}</p>
                    <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500 sm:text-[10px]">Business Category</p>
                    <p className="text-xs font-bold text-slate-900 sm:text-xl">{businessCategory}</p>
                  </div>
                  <div className="self-center text-center">
                    <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">QR Verification</p>
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5 sm:p-2">
                      <img src={qrDataUrl} alt="Verification QR" className="mx-auto h-20 w-20 sm:h-36 sm:w-36" />
                    </div>
                    <p className="mt-1 text-[8px] text-slate-600 sm:text-[10px]">Scan to verify instantly</p>
                    <p className="text-[7px] text-slate-500 sm:text-[9px]">{verifyUrl}</p>
                  </div>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 grid grid-cols-[1.5fr_0.9fr_0.9fr_0.7fr] items-center border-t border-slate-200 bg-white px-4 py-2 sm:px-6 sm:py-3" style={{ height: "20%" }}>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">MSME ID</p>
                  <p className="text-[10px] font-black text-emerald-800 sm:text-3xl">{msmeId}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">Status</p>
                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:text-sm">{displayStatus}</span>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">Expiry Date</p>
                  <p className="text-[10px] font-bold text-emerald-800 sm:text-2xl">{cardExpiry}</p>
                </div>
                <div className="hidden h-full place-items-center rounded-lg border border-slate-200 bg-slate-100 text-[10px] text-slate-500 sm:grid">
                  Federal Crest
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ActionButton
              title={busy === "pdf" ? "Preparing PDF..." : "Download ID Card"}
              helper="High quality (PDF)"
              icon={<FileDown className="h-4 w-4" />}
              onClick={downloadPdf}
              disabled={busy !== "none"}
              variant="primary"
            />
            <ActionButton
              title={busy === "png" ? "Preparing PNG..." : "Download for Mobile"}
              helper="Wallet friendly (PNG)"
              icon={<FileText className="h-4 w-4" />}
              onClick={downloadPng}
              disabled={busy !== "none"}
            />
            <ActionButton
              title={busy === "share" ? "Sharing..." : "Share ID Card"}
              helper="Share secure link"
              icon={<Send className="h-4 w-4" />}
              onClick={shareCard}
              disabled={busy !== "none"}
            />
            <div>
              <PrintButton targetId="msme-id-card-canvas" className="h-full w-full" label="Print ID Card" helper="Print ready version" icon={<QrCode className="h-4 w-4" />} />
            </div>
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Use Your ID Card For</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>• Business verification and trust building</li>
            <li>• Access to opportunities and programs</li>
            <li>• Official MSME identity validation</li>
            <li>• Partnerships and vendor onboarding</li>
            <li>• Loans and financial services</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Keep Your Profile Updated</h3>
          <p className="mt-2 text-sm text-slate-700">Update your business information regularly to stay verified and unlock more opportunities.</p>
          <Link href="/dashboard/msme/profile" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            Update Business Profile <ExternalLink className="h-4 w-4" />
          </Link>
        </article>

        <article className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><HelpCircle className="h-5 w-5 text-amber-700" />Need Help?</h3>
          <p className="mt-2 text-sm text-slate-700">Learn more about NDMII verification and how to use your Digital ID Card.</p>
          <button className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700">View Help Center <ExternalLink className="h-4 w-4" /></button>
        </article>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        This is an official credential issued by the National Digital MSME Identity Initiative (NDMII), Federal Republic of Nigeria. Misuse or falsification of this credential is punishable by law.
      </div>
    </section>
  );
}
