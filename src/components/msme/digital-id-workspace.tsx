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

const A4_LANDSCAPE_WIDTH_PT = 841.89;
const A4_LANDSCAPE_HEIGHT_PT = 595.28;
const POCKET_CARD_WIDTH_PX = 1712;
const POCKET_CARD_HEIGHT_PX = 1080;

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

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

async function toJpegBlob(canvas: HTMLCanvasElement, quality = 0.94) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to generate image data."));
        return;
      }

      resolve(blob);
    }, "image/jpeg", quality);
  });
}

async function toPngBlob(canvas: HTMLCanvasElement) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to generate PNG data."));
        return;
      }

      resolve(blob);
    }, "image/png", 1);
  });
}

async function buildPdfFromJpeg(jpegBlob: Blob, fileName: string) {
  const imageBuffer = await jpegBlob.arrayBuffer();
  const bytes = new Uint8Array(imageBuffer);

  const margin = 24;
  const imageW = A4_LANDSCAPE_WIDTH_PT - margin * 2;
  const imageH = A4_LANDSCAPE_HEIGHT_PT - margin * 2;

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LANDSCAPE_WIDTH_PT.toFixed(2)} ${A4_LANDSCAPE_HEIGHT_PT.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >> endobj`,
    `4 0 obj << /Type /XObject /Subtype /Image /Width ${POCKET_CARD_WIDTH_PX} /Height ${POCKET_CARD_HEIGHT_PX} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >> stream\n__IMAGE_STREAM__\nendstream\nendobj`,
    `5 0 obj << /Length ${["q", `${imageW.toFixed(2)} 0 0 ${imageH.toFixed(2)} ${margin.toFixed(2)} ${margin.toFixed(2)} cm`, "/Im0 Do", "Q"].join("\n").length} >> stream\nq\n${imageW.toFixed(2)} 0 0 ${imageH.toFixed(2)} ${margin.toFixed(2)} ${margin.toFixed(2)} cm\n/Im0 Do\nQ\nendstream\nendobj`,
    `6 0 obj << /Title (${escapePdfText(fileName)}) >> endobj`,
  ];

  const header = "%PDF-1.4\n%âãÏÓ\n";
  let offset = header.length;
  const chunks: BlobPart[] = [header];
  const xref: number[] = [0];

  for (const object of objects) {
    xref.push(offset);
    if (object.includes("__IMAGE_STREAM__")) {
      const [before, after] = object.split("__IMAGE_STREAM__");
      chunks.push(before);
      offset += before.length;
      chunks.push(imageBuffer);
      offset += bytes.length;
      chunks.push(after);
      offset += after.length;
    } else {
      chunks.push(object + "\n");
      offset += object.length + 1;
    }
  }

  const xrefStart = offset;
  let xrefText = `xref\n0 ${xref.length}\n`;
  xrefText += "0000000000 65535 f \n";
  for (let i = 1; i < xref.length; i += 1) {
    xrefText += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${xref.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  chunks.push(xrefText);
  chunks.push(trailer);

  const pdfBlob = new Blob(chunks, { type: "application/pdf" });
  downloadBlob(pdfBlob, fileName);
}

async function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#032E24");
  gradient.addColorStop(0.6, "#074537");
  gradient.addColorStop(1, "#0A6A4E");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 14; i += 1) {
    ctx.strokeStyle = `rgba(167,243,208,${0.08 - i * 0.004})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-120, 40 + i * 78);
    ctx.bezierCurveTo(width * 0.3, 10 + i * 62, width * 0.7, 106 + i * 68, width + 100, 58 + i * 70);
    ctx.stroke();
  }

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(width * 0.63, height * 0.33, height * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

async function drawPocketCard(
  ctx: CanvasRenderingContext2D,
  data: {
    businessName: string;
    ownerName: string;
    businessCategory: string;
    businessType: string;
    msmeId: string;
    displayStatus: string;
    expiryDate: string;
    qrDataUrl: string;
    passportPhotoUrl?: string | null;
  },
) {
  await drawBackground(ctx, POCKET_CARD_WIDTH_PX, POCKET_CARD_HEIGHT_PX);

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "700 38px Inter, Arial";
  ctx.fillText("BUSINESS IDENTITY NETWORK", 70, 84);

  ctx.font = "900 72px Inter, Arial";
  ctx.textAlign = "right";
  ctx.fillText("BIN", POCKET_CARD_WIDTH_PX - 70, 94);
  ctx.textAlign = "left";

  ctx.font = "700 68px Inter, Arial";
  ctx.fillText(data.businessName, 70, 190, 1100);
  ctx.font = "600 52px Inter, Arial";
  ctx.fillStyle = "#c8f79a";
  ctx.fillText(`${data.businessCategory} • ${data.businessType}`, 70, 266, 980);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(70, 304, POCKET_CARD_WIDTH_PX - 140, 2);

  ctx.save();
  ctx.beginPath();
  const photoW = 286;
  const photoH = 346;
  const photoX = 70;
  const photoY = 348;
  const radius = 22;
  ctx.moveTo(photoX + radius, photoY);
  ctx.lineTo(photoX + photoW - radius, photoY);
  ctx.arcTo(photoX + photoW, photoY, photoX + photoW, photoY + radius, radius);
  ctx.lineTo(photoX + photoW, photoY + photoH - radius);
  ctx.arcTo(photoX + photoW, photoY + photoH, photoX + photoW - radius, photoY + photoH, radius);
  ctx.lineTo(photoX + radius, photoY + photoH);
  ctx.arcTo(photoX, photoY + photoH, photoX, photoY + photoH - radius, radius);
  ctx.lineTo(photoX, photoY + radius);
  ctx.arcTo(photoX, photoY, photoX + radius, photoY, radius);
  ctx.closePath();
  ctx.clip();

  if (data.passportPhotoUrl) {
    try {
      const photoImage = await loadImage(data.passportPhotoUrl);
      ctx.drawImage(photoImage, photoX, photoY, photoW, photoH);
    } catch {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.fillStyle = "#d1fae5";
      ctx.font = "600 26px Inter, Arial";
      ctx.fillText("Passport unavailable", photoX + 22, photoY + photoH / 2);
    }
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = "#d1fae5";
    ctx.font = "600 26px Inter, Arial";
    ctx.fillText("Passport unavailable", photoX + 22, photoY + photoH / 2);
  }
  ctx.restore();

  const qr = await loadImage(data.qrDataUrl);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(POCKET_CARD_WIDTH_PX - 284, 372, 214, 214);
  ctx.drawImage(qr, POCKET_CARD_WIDTH_PX - 275, 381, 196, 196);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 26px Inter, Arial";
  ctx.fillText("BUSINESS ID", 390, 420);
  ctx.font = "700 40px Inter, Arial";
  ctx.fillText(data.msmeId, 390, 470);

  ctx.font = "700 26px Inter, Arial";
  ctx.fillText("Owner", 390, 536);
  ctx.font = "700 44px Inter, Arial";
  ctx.fillText(data.ownerName, 390, 590, 770);

  ctx.font = "700 26px Inter, Arial";
  ctx.fillText("Status", 390, 652);
  ctx.font = "700 44px Inter, Arial";
  ctx.fillStyle = data.displayStatus.toLowerCase() === "verified" ? "#86efac" : "#fde68a";
  ctx.fillText(data.displayStatus.toLowerCase() === "verified" ? "BIN Verified" : data.displayStatus, 390, 706);

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, POCKET_CARD_HEIGHT_PX - 120, POCKET_CARD_WIDTH_PX, 120);
  ctx.fillStyle = "#f0fdf4";
  ctx.font = "700 36px Inter, Arial";
  ctx.fillText(`Expiry: ${data.expiryDate}`, 70, POCKET_CARD_HEIGHT_PX - 46);
  ctx.textAlign = "right";
  ctx.fillText("BIN Verified • Trusted • Shareable", POCKET_CARD_WIDTH_PX - 70, POCKET_CARD_HEIGHT_PX - 46);
  ctx.textAlign = "left";
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
  const [busy, setBusy] = useState<"none" | "pdf" | "png" | "share">("none");
  const [error, setError] = useState<string | null>(null);

  const displayStatus = useMemo(() => formatStatus(verificationStatus || "pending_review"), [verificationStatus]);
  const isVerified = useMemo(() => displayStatus.toLowerCase() === "verified", [displayStatus]);
  const expiryDate = "April 2027";

  const shareCard = useCallback(async () => {
    setBusy("share");
    setError(null);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "BIN Business Identity Credential",
          text: `Verify business identity credential: ${msmeId}`,
          url: verifyUrl,
        });
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(verifyUrl);
      }
    } catch {
      setError("Unable to share this credential right now. Please try again.");
    } finally {
      setBusy("none");
    }
  }, [msmeId, verifyUrl]);

  const downloadPocketPng = useCallback(async () => {
    setBusy("png");
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = POCKET_CARD_WIDTH_PX;
      canvas.height = POCKET_CARD_HEIGHT_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not initialize image renderer.");
      }

      await drawPocketCard(ctx, {
        businessName,
        ownerName,
        businessCategory,
        businessType,
        msmeId,
        displayStatus,
        expiryDate,
        qrDataUrl,
        passportPhotoUrl,
      });

      const pngBlob = await toPngBlob(canvas);
      downloadBlob(pngBlob, `${msmeId.toLowerCase()}-pocket-id.png`);
    } catch {
      setError("Could not generate PNG pocket credential. Please retry.");
    } finally {
      setBusy("none");
    }
  }, [businessCategory, businessName, businessType, displayStatus, expiryDate, msmeId, ownerName, passportPhotoUrl, qrDataUrl]);

  const downloadPdf = useCallback(async () => {
    setBusy("pdf");
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = POCKET_CARD_WIDTH_PX;
      canvas.height = POCKET_CARD_HEIGHT_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not initialize PDF renderer.");
      }

      await drawPocketCard(ctx, {
        businessName,
        ownerName,
        businessCategory,
        businessType,
        msmeId,
        displayStatus,
        expiryDate,
        qrDataUrl,
        passportPhotoUrl,
      });

      const jpegBlob = await toJpegBlob(canvas);
      await buildPdfFromJpeg(jpegBlob, `${msmeId.toLowerCase()}-business-identity-credential.pdf`);
    } catch {
      setError("Could not generate PDF. Please retry.");
    } finally {
      setBusy("none");
    }
  }, [businessCategory, businessName, businessType, displayStatus, expiryDate, msmeId, ownerName, passportPhotoUrl, qrDataUrl]);

  return (
    <section className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">{isVerified ? "Verified MSME" : "Pending MSME"}</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Business Identity Credential</h1>
        </div>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          <button
            type="button"
            onClick={shareCard}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" /> {busy === "share" ? "Sharing..." : "Share Credential"}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {busy === "pdf" ? "Preparing PDF..." : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={downloadPocketPng}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {busy === "png" ? "Preparing PNG..." : "Download PNG (Pocket Credential)"}
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <article className="relative overflow-hidden rounded-2xl border border-emerald-300/20 bg-[linear-gradient(135deg,#063C2E,#0A5F47)] p-4 shadow-2xl ring-1 ring-white/20 sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-10 [background:repeating-linear-gradient(135deg,rgba(255,255,255,.14)_0_2px,transparent_2px_16px)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_80%_22%,#fff_0,transparent_38%),radial-gradient(circle_at_88%_78%,#fff_0,transparent_26%)]" />
        <div className="pointer-events-none absolute bottom-6 right-6 h-28 w-28 rounded-full border border-emerald-100/20 bg-white/5 sm:h-44 sm:w-44" />
        <div className="pointer-events-none absolute right-7 top-7 text-right text-emerald-100/90">
          <p className="text-3xl font-black leading-none sm:text-6xl">BIN</p>
          <p className="mt-1 text-[10px] sm:text-sm">BIN Verified • Trusted • Shareable</p>
        </div>

        <div className="pointer-events-none absolute bottom-8 right-6 hidden text-emerald-100/10 sm:block">
          <svg viewBox="0 0 200 200" className="h-32 w-32">
            <path d="M52 25l25 7 18-5 12 11 18-2 11 18 20 16-9 20 6 23-18 15-9 18-24-2-17 15-20-7-22 8-16-17-23-3-8-20-20-16 7-20-7-22 20-16 7-22 23-1 17-14z" fill="currentColor" />
          </svg>
        </div>

        <div className="relative z-10 space-y-4" id="msme-id-card-full-view">
          <div className="flex items-start justify-between gap-4 border-b border-white/20 pb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-100">Business Identity Network</p>
              <h2 className="mt-1 text-xl font-semibold text-white sm:text-5xl">Business Identity Network</h2>
              <p className="mt-1 text-sm text-emerald-50 sm:text-2xl">Verified Business Identity Credential</p>
              <p className="mt-2 max-w-3xl text-xs text-emerald-100/90 sm:text-sm">A trusted digital business identity for verified MSMEs, associations, and enterprise partners.</p>
            </div>
            <span className={`mt-1 inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur ${isVerified ? "border-emerald-100/60 bg-emerald-300/20 text-emerald-50 shadow-[0_0_24px_rgba(74,222,128,.55)]" : "border-amber-100/60 bg-amber-300/20 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,.45)]"}`}>
              {isVerified ? "BIN Verified" : "Pending Review"}
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
                <p className="text-xs uppercase tracking-widest text-emerald-100">Scan to verify this business identity</p>
                <p className="text-sm">Instantly verify this credential on the Business Identity Network registry.</p>
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

      <div aria-hidden="true" className="fixed -left-[9999px] -top-[9999px] h-px w-px overflow-hidden">
        <article className="h-[540px] w-[856px]" id="msme-pocket-id-export-template" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-emerald-700" /> Verified Business Profile</p>
          <p className="mt-2 text-sm text-slate-600">A trusted digital business identity for verified MSMEs, associations, and enterprise partners.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><LockKeyhole className="h-4 w-4 text-emerald-700" /> Secure Digital Credential</p>
          <p className="mt-2 text-sm text-slate-600">Encrypted metadata and QR verification ensure authenticity.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><Globe2 className="h-4 w-4 text-emerald-700" /> Shareable Identity Card</p>
          <p className="mt-2 text-sm text-slate-600">Share your verified MSME identity with confidence anywhere.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><BadgeCheck className="h-4 w-4 text-emerald-700" /> Partner-Ready Verification</p>
          <p className="mt-2 text-sm text-slate-600">Designed for trusted verification across associations, lenders, buyers, and enterprise platforms.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="inline-flex items-center gap-2 font-medium text-slate-800"><CheckCircle2 className="h-4 w-4 text-emerald-700" /> This credential confirms that the business profile has been registered and validated within the Business Identity Network.</p>
        <p className="mt-1 text-xs text-slate-500">BIN is an independent business identity and verification network designed to support partnerships with public institutions, associations, lenders, and marketplaces.</p>
      </div>
    </section>
  );
}
