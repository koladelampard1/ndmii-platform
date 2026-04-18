"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  HelpCircle,
  IdCard,
  Printer,
  Send,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { PassportPhoto } from "@/components/msme/passport-photo";

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
const EXPORT_BASE_WIDTH = 1600;
const EXPORT_BASE_HEIGHT = Math.round(EXPORT_BASE_WIDTH / ID_RATIO);
const PDF_EXPORT_SCALE = 3;
const PNG_EXPORT_SCALE = 3;

function formatStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;

  const clipped = lines.slice(0, maxLines);
  const lastIndex = maxLines - 1;
  const lastLine = clipped[lastIndex] ?? "";
  clipped[lastIndex] = `${lastLine.slice(0, Math.max(lastLine.length - 2, 0))}…`;

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

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildPdfFromJpeg(jpegData: Uint8Array, imageWidth: number, imageHeight: number) {
  const encoder = new TextEncoder();
  const pdfWidth = 842;
  const pdfHeight = Math.round(pdfWidth / ID_RATIO);
  const margin = 24;
  const drawWidth = pdfWidth - margin * 2;
  const drawHeight = Math.round(drawWidth / ID_RATIO);
  const drawY = Math.round((pdfHeight - drawHeight) / 2);

  const contentStream = `q\n${drawWidth} 0 0 ${drawHeight} ${margin} ${drawY} cm\n/Im0 Do\nQ`;

  const objects: Array<Uint8Array> = [];

  const addTextObject = (body: string) => {
    objects.push(encoder.encode(body));
  };

  addTextObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  addTextObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  addTextObject(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth} ${pdfHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  const imageHeader = encoder.encode(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegData.length} >>\nstream\n`,
  );
  const imageFooter = encoder.encode("\nendstream\nendobj\n");
  const imageObject = new Uint8Array(imageHeader.length + jpegData.length + imageFooter.length);
  imageObject.set(imageHeader, 0);
  imageObject.set(jpegData, imageHeader.length);
  imageObject.set(imageFooter, imageHeader.length + jpegData.length);
  objects.push(imageObject);

  addTextObject(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

  const header = encoder.encode("%PDF-1.4\n");
  let size = header.length;
  const offsets: number[] = [0];

  objects.forEach((obj) => {
    offsets.push(size);
    size += obj.length;
  });

  const xrefStart = size;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const xrefBytes = encoder.encode(xref);
  const trailerBytes = encoder.encode(trailer);

  const finalBytes = new Uint8Array(size + xrefBytes.length + trailerBytes.length);
  let cursor = 0;
  finalBytes.set(header, cursor);
  cursor += header.length;

  objects.forEach((obj) => {
    finalBytes.set(obj, cursor);
    cursor += obj.length;
  });

  finalBytes.set(xrefBytes, cursor);
  cursor += xrefBytes.length;
  finalBytes.set(trailerBytes, cursor);

  return new Blob([finalBytes], { type: "application/pdf" });
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
  const [busy, setBusy] = useState<"none" | "pdf" | "png" | "share" | "print">("none");

  const cardExpiry = "April 2027";
  const displayStatus = useMemo(() => formatStatus(verificationStatus || "pending_review"), [verificationStatus]);

  const drawExportCanvas = useCallback(
    async (scale: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(EXPORT_BASE_WIDTH * scale);
      canvas.height = Math.round(EXPORT_BASE_HEIGHT * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      ctx.scale(scale, scale);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      roundedRectPath(ctx, 0, 0, EXPORT_BASE_WIDTH, EXPORT_BASE_HEIGHT, 36);
      ctx.clip();

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, EXPORT_BASE_WIDTH, EXPORT_BASE_HEIGHT);

      const headerHeight = 286;
      const footerHeight = 132;
      const bodyY = headerHeight;

      const gradient = ctx.createLinearGradient(0, 0, EXPORT_BASE_WIDTH, 0);
      gradient.addColorStop(0, "#064e3b");
      gradient.addColorStop(0.45, "#065f46");
      gradient.addColorStop(1, "#047857");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, EXPORT_BASE_WIDTH, headerHeight);

      for (let i = 0; i < 9; i += 1) {
        ctx.strokeStyle = `rgba(167, 243, 208, ${0.08 - i * 0.007})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(EXPORT_BASE_WIDTH - 120, headerHeight + 36, 120 + i * 50, Math.PI, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "#a7f3d0";
      ctx.font = "700 22px Inter, Arial, sans-serif";
      ctx.fillText("FEDERAL REPUBLIC OF NIGERIA", 62, 66);

      ctx.fillStyle = "#ecfdf5";
      ctx.font = "700 58px Inter, Arial, sans-serif";
      ctx.fillText("National Digital MSME Identity Initiative", 62, 140);
      ctx.font = "500 34px Inter, Arial, sans-serif";
      ctx.fillText("Official Business Identity Credential", 62, 196);

      ctx.font = "800 68px Inter, Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("NDMII", EXPORT_BASE_WIDTH - 68, 136);
      ctx.font = "600 24px Inter, Arial, sans-serif";
      ctx.fillText("Verified • Trusted • Empowered", EXPORT_BASE_WIDTH - 68, 188);
      ctx.textAlign = "left";

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, bodyY, EXPORT_BASE_WIDTH, EXPORT_BASE_HEIGHT - headerHeight - footerHeight);

      ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 16; i += 1) {
        ctx.beginPath();
        const y = bodyY + 24 + i * 34;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(EXPORT_BASE_WIDTH * 0.34, y + 20, EXPORT_BASE_WIDTH * 0.66, y - 10, EXPORT_BASE_WIDTH, y + 16);
        ctx.stroke();
      }

      const photoX = 64;
      const photoY = bodyY + 56;
      const photoW = 236;
      const photoH = 330;

      roundedRectPath(ctx, photoX, photoY, photoW, photoH, 20);
      ctx.fillStyle = "#e2e8f0";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (passportPhotoUrl) {
        try {
          const passport = await loadImage(passportPhotoUrl, "anonymous");
          ctx.save();
          roundedRectPath(ctx, photoX, photoY, photoW, photoH, 20);
          ctx.clip();
          ctx.drawImage(passport, photoX, photoY, photoW, photoH);
          ctx.restore();
        } catch {
          ctx.fillStyle = "#64748b";
          ctx.font = "700 92px Inter, Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("N", photoX + photoW / 2, photoY + photoH / 2 + 22);
          ctx.font = "500 28px Inter, Arial, sans-serif";
          ctx.fillText("Passport photo", photoX + photoW / 2, photoY + photoH - 46);
          ctx.fillText("unavailable", photoX + photoW / 2, photoY + photoH - 16);
          ctx.textAlign = "left";
        }
      } else {
        ctx.fillStyle = "#64748b";
        ctx.font = "700 92px Inter, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("N", photoX + photoW / 2, photoY + photoH / 2 + 22);
        ctx.font = "500 28px Inter, Arial, sans-serif";
        ctx.fillText("Passport photo", photoX + photoW / 2, photoY + photoH - 46);
        ctx.fillText("unavailable", photoX + photoW / 2, photoY + photoH - 16);
        ctx.textAlign = "left";
      }

      const textX = 352;
      const textWidth = 760;

      ctx.fillStyle = "#64748b";
      ctx.font = "700 19px Inter, Arial, sans-serif";
      ctx.fillText("BUSINESS NAME", textX, bodyY + 74);

      ctx.fillStyle = "#0f172a";
      ctx.font = "700 58px Inter, Arial, sans-serif";
      wrapText(ctx, businessName || "Not provided", textWidth, 2).forEach((line, index) => {
        ctx.fillText(line, textX, bodyY + 146 + index * 62);
      });

      ctx.fillStyle = "#64748b";
      ctx.font = "700 19px Inter, Arial, sans-serif";
      ctx.fillText("BUSINESS OWNER EMAIL", textX, bodyY + 254);
      ctx.fillStyle = "#111827";
      ctx.font = "700 40px Inter, Arial, sans-serif";
      wrapText(ctx, ownerEmail || "Not provided", textWidth, 1).forEach((line) => {
        ctx.fillText(line, textX, bodyY + 304);
      });

      ctx.fillStyle = "#64748b";
      ctx.font = "700 19px Inter, Arial, sans-serif";
      ctx.fillText("BUSINESS CATEGORY", textX, bodyY + 360);
      ctx.fillStyle = "#1f2937";
      ctx.font = "700 42px Inter, Arial, sans-serif";
      ctx.fillText(businessCategory || "Unspecified", textX, bodyY + 410);

      const qrX = EXPORT_BASE_WIDTH - 346;
      const qrY = bodyY + 98;
      const qrSize = 224;

      ctx.fillStyle = "#ffffff";
      roundedRectPath(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 18);
      ctx.fill();
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 2;
      ctx.stroke();

      const qr = await loadImage(qrDataUrl);
      ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = "#64748b";
      ctx.font = "700 18px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("QR VERIFICATION", qrX + qrSize / 2, bodyY + 70);
      ctx.font = "500 21px Inter, Arial, sans-serif";
      ctx.fillStyle = "#334155";
      ctx.fillText("Scan to verify instantly", qrX + qrSize / 2, bodyY + 364);
      ctx.font = "500 16px Inter, Arial, sans-serif";
      ctx.fillText(verifyUrl, qrX + qrSize / 2, bodyY + 392);
      ctx.textAlign = "left";

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, EXPORT_BASE_HEIGHT - footerHeight, EXPORT_BASE_WIDTH, footerHeight);
      ctx.strokeStyle = "#d1d5db";
      ctx.beginPath();
      ctx.moveTo(0, EXPORT_BASE_HEIGHT - footerHeight);
      ctx.lineTo(EXPORT_BASE_WIDTH, EXPORT_BASE_HEIGHT - footerHeight);
      ctx.stroke();

      const footerBaseY = EXPORT_BASE_HEIGHT - 56;

      ctx.fillStyle = "#64748b";
      ctx.font = "700 18px Inter, Arial, sans-serif";
      ctx.fillText("MSME ID", 62, footerBaseY - 28);
      ctx.fillStyle = "#065f46";
      ctx.font = "800 45px Inter, Arial, sans-serif";
      ctx.fillText(msmeId, 62, footerBaseY + 26);

      ctx.fillStyle = "#64748b";
      ctx.font = "700 18px Inter, Arial, sans-serif";
      ctx.fillText("STATUS", 714, footerBaseY - 28);
      roundedRectPath(ctx, 714, footerBaseY - 10, 176, 48, 22);
      ctx.fillStyle = "#dcfce7";
      ctx.fill();
      ctx.fillStyle = "#15803d";
      ctx.font = "700 25px Inter, Arial, sans-serif";
      ctx.fillText(displayStatus, 738, footerBaseY + 23);

      ctx.fillStyle = "#64748b";
      ctx.font = "700 18px Inter, Arial, sans-serif";
      ctx.fillText("EXPIRY DATE", 952, footerBaseY - 28);
      ctx.fillStyle = "#065f46";
      ctx.font = "700 40px Inter, Arial, sans-serif";
      ctx.fillText(cardExpiry, 952, footerBaseY + 22);

      roundedRectPath(ctx, EXPORT_BASE_WIDTH - 210, EXPORT_BASE_HEIGHT - 102, 152, 72, 16);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.font = "700 20px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Federal", EXPORT_BASE_WIDTH - 134, EXPORT_BASE_HEIGHT - 70);
      ctx.fillText("Crest", EXPORT_BASE_WIDTH - 134, EXPORT_BASE_HEIGHT - 44);
      ctx.textAlign = "left";

      return canvas;
    },
    [businessCategory, businessName, cardExpiry, displayStatus, msmeId, ownerEmail, passportPhotoUrl, qrDataUrl, verifyUrl],
  );

  const downloadWalletPng = useCallback(async () => {
    setBusy("png");
    try {
      const canvas = await drawExportCanvas(PNG_EXPORT_SCALE);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) return;
      downloadBlob(blob, `${msmeId.toLowerCase()}-wallet-id-card.png`);
    } finally {
      setBusy("none");
    }
  }, [drawExportCanvas, msmeId]);

  const downloadHighResPdf = useCallback(async () => {
    setBusy("pdf");
    try {
      const canvas = await drawExportCanvas(PDF_EXPORT_SCALE);
      const jpegDataUrl = canvas.toDataURL("image/jpeg", 1);
      const jpegBytes = dataUrlToBytes(jpegDataUrl);
      const pdfBlob = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height);
      downloadBlob(pdfBlob, `${msmeId.toLowerCase()}-digital-id-card.pdf`);
    } finally {
      setBusy("none");
    }
  }, [drawExportCanvas, msmeId]);

  const printCard = useCallback(async () => {
    setBusy("print");
    try {
      const canvas = await drawExportCanvas(PDF_EXPORT_SCALE);
      const dataUrl = canvas.toDataURL("image/png", 1);

      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
      if (!printWindow) return;

      printWindow.document.write(`<!doctype html>
        <html>
          <head>
            <title>NDMII MSME ID Card</title>
            <style>
              @page { size: A4 portrait; margin: 14mm; }
              html, body { margin: 0; background: #ffffff; }
              body { min-height: 100vh; display: grid; place-items: center; }
              .sheet { width: min(180mm, 95vw); }
              .sheet img { width: 100%; height: auto; display: block; border-radius: 14px; }
            </style>
          </head>
          <body>
            <div class="sheet"><img src="${dataUrl}" alt="NDMII Digital ID Card" /></div>
            <script>window.onload = () => window.print();</script>
          </body>
        </html>`);
      printWindow.document.close();
    } finally {
      setBusy("none");
    }
  }, [drawExportCanvas]);

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

  const ActionPill = ({ title, helper, icon, onClick, disabled, prominent = false }: { title: string; helper: string; icon: ReactNode; onClick: () => void; disabled?: boolean; prominent?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
        prominent
          ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${prominent ? "bg-emerald-600" : "bg-slate-100"}`}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className={`block text-xs ${prominent ? "text-emerald-100" : "text-slate-500"}`}>{helper}</span>
      </span>
    </button>
  );

  return (
    <section className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Digital ID Card</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified
            </span>
          </div>
          <p className="text-sm text-slate-600">Your official NDMII identity credential. Download, print, or share your MSME digital ID.</p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={downloadHighResPdf}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {busy === "pdf" ? "Preparing..." : "Download ID Card"}
          </button>
          <button
            type="button"
            onClick={printCard}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Printer className="h-4 w-4" /> Print ID Card
          </button>
          <button
            type="button"
            onClick={shareCard}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Share ID Card
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Verified • Trusted • Empowered</p>
            <p className="text-sm text-slate-600">This MSME is registered and verified on the National Digital MSME Identity Initiative (NDMII) platform.</p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-800">
          Learn more about NDMII <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Your Digital ID Card</h2>
          <span className="text-sm font-medium text-slate-500">Valid until {cardExpiry}</span>
        </div>

        <div className="mx-auto w-full max-w-6xl">
          <div
            id="ndmii-id-card"
            className="relative w-full overflow-hidden rounded-3xl border border-slate-200 shadow-[0_20px_48px_-22px_rgba(15,23,42,0.35)]"
            style={{ aspectRatio: ID_RATIO }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700" style={{ height: "29%" }}>
              <div className="absolute inset-x-0 top-0 h-full overflow-hidden">
                <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full border border-emerald-300/20" />
                <div className="absolute right-16 top-2 h-64 w-64 rounded-full border border-emerald-300/15" />
                <div className="absolute right-36 top-12 h-72 w-72 rounded-full border border-emerald-300/10" />
              </div>
              <div className="relative px-4 py-3 text-white sm:px-7 sm:py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200 sm:text-xs">Federal Republic of Nigeria</p>
                <p className="mt-1 text-base font-bold sm:text-3xl">National Digital MSME Identity Initiative</p>
                <p className="text-[11px] text-emerald-100 sm:text-sm">Official Business Identity Credential</p>
                <div className="absolute right-4 top-3 text-right sm:right-7 sm:top-5">
                  <p className="text-lg font-black tracking-tight sm:text-4xl">NDMII</p>
                  <p className="text-[9px] text-emerald-100 sm:text-xs">Verified • Trusted • Empowered</p>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 grid grid-cols-[110px_1fr_126px] gap-3 bg-slate-50 px-4 py-3 sm:grid-cols-[210px_1fr_220px] sm:gap-6 sm:px-7 sm:py-5" style={{ top: "29%", bottom: "20%" }}>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <PassportPhoto
                  src={passportPhotoUrl}
                  alt="Passport photo"
                  className="h-full w-full object-cover"
                  placeholderClassName="flex h-full flex-col items-center justify-center bg-slate-200 text-slate-500"
                  placeholder={
                    <>
                      <UserRound className="h-8 w-8 sm:h-12 sm:w-12" />
                      <p className="mt-2 text-center text-[9px] font-medium sm:text-xs">Passport photo unavailable</p>
                    </>
                  }
                />
              </div>

              <div className="min-w-0 self-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500 sm:text-[10px]">Business Name</p>
                <p className="text-sm font-bold leading-tight text-slate-900 sm:text-4xl [overflow-wrap:anywhere]">{businessName}</p>
                <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500 sm:mt-4 sm:text-[10px]">Business Owner Email</p>
                <p className="text-[11px] font-semibold text-slate-800 sm:text-xl [overflow-wrap:anywhere]">{ownerEmail}</p>
                <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500 sm:mt-4 sm:text-[10px]">Business Category</p>
                <p className="text-xs font-bold text-slate-900 sm:text-2xl">{businessCategory}</p>
              </div>

              <div className="self-center text-center">
                <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">QR Verification</p>
                <div className="mx-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:p-2.5">
                  <img src={qrDataUrl} alt="Verification QR" className="mx-auto h-20 w-20 sm:h-40 sm:w-40" />
                </div>
                <p className="mt-1 text-[8px] text-slate-600 sm:text-[10px]">Scan to verify instantly</p>
                <p className="text-[7px] text-slate-500 sm:text-[9px]">{verifyUrl}</p>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 grid grid-cols-[1.45fr_0.8fr_0.95fr_0.7fr] items-center border-t border-slate-200 bg-white px-4 py-2 sm:px-7 sm:py-3" style={{ height: "20%" }}>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">MSME ID</p>
                <p className="break-all text-[11px] font-black text-emerald-800 sm:text-4xl">{msmeId}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">Status</p>
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:text-sm">{displayStatus}</span>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">Expiry Date</p>
                <p className="text-[11px] font-bold text-emerald-800 sm:text-3xl">{cardExpiry}</p>
              </div>
              <div className="hidden h-full place-items-center rounded-xl border border-slate-200 bg-slate-100 text-center text-[10px] font-medium text-slate-500 sm:grid">
                Federal<br />Crest
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <ActionPill
            title={busy === "pdf" ? "Preparing PDF..." : "Download ID Card"}
            helper="High-quality PDF"
            icon={<Download className="h-4 w-4" />}
            onClick={downloadHighResPdf}
            disabled={busy !== "none"}
            prominent
          />
          <ActionPill
            title={busy === "png" ? "Preparing PNG..." : "Download for Mobile"}
            helper="Wallet-friendly PNG"
            icon={<Smartphone className="h-4 w-4" />}
            onClick={downloadWalletPng}
            disabled={busy !== "none"}
          />
          <ActionPill
            title={busy === "print" ? "Preparing Print..." : "Print ID Card"}
            helper="Print-ready version"
            icon={<Printer className="h-4 w-4" />}
            onClick={printCard}
            disabled={busy !== "none"}
          />
          <ActionPill
            title={busy === "share" ? "Sharing..." : "Share ID Card"}
            helper="Secure verification link"
            icon={<Send className="h-4 w-4" />}
            onClick={shareCard}
            disabled={busy !== "none"}
          />
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <IdCard className="h-5 w-5 text-emerald-700" /> Use Your ID Card For
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Business verification and trust building</li>
            <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Access to opportunities and programs</li>
            <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Official MSME identity validation</li>
            <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Vendor onboarding</li>
            <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Loans and financial services</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Keep Your Profile Updated</h3>
          <p className="mt-2 text-sm text-slate-700">Update your business information regularly to maintain verification status and unlock opportunities.</p>
          <Link href="/dashboard/msme/profile" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            Update Business Profile <ExternalLink className="h-4 w-4" />
          </Link>
        </article>

        <article className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <HelpCircle className="h-5 w-5 text-amber-700" /> Need Help?
          </h3>
          <p className="mt-2 text-sm text-slate-700">Learn how to use your MSME Digital ID Card for verification, partnerships, and onboarding.</p>
          <button className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700">
            View Help Center <ExternalLink className="h-4 w-4" />
          </button>
        </article>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        This is an official credential issued by the National Digital MSME Identity Initiative (NDMII), Federal Republic of Nigeria.<br />
        Misuse or falsification of this credential is punishable by law.
      </div>
    </section>
  );
}
