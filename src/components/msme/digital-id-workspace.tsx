"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { BadgeCheck, CheckCircle2, Download, Globe2, LockKeyhole, Share2, ShieldCheck } from "lucide-react";
import { PassportPhoto } from "@/components/msme/passport-photo";

type DigitalIdWorkspaceProps = {
  associationName?: string | null;
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

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type CredentialModel = {
  associationName: string;
  profileSubtitle: string;
  memberSubtitle: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  businessCategory: string;
  businessType: string;
  cacNumber: string;
  phoneNumber: string;
  businessAddress: string;
  businessId: string;
  displayStatus: string;
  statusTone: "verified" | "pending_review" | "suspended";
  expiryDate: string;
  passportPhotoUrl?: string | null;
  verifyUrl: string;
  qrDataUrl: string;
};

const A4_PORTRAIT_WIDTH_PT = 595.28;
const A4_PORTRAIT_HEIGHT_PT = 841.89;
const FULL_EXPORT_WIDTH = 768;
const FULL_EXPORT_HEIGHT = 1120;
const POCKET_CARD_WIDTH_PX = 768;
const POCKET_CARD_HEIGHT_PX = 1120;

function formatStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function sanitizeFileSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeBusinessId(value: string) {
  return value?.startsWith("NDMII-") ? value.replace(/^NDMII-/, "BIN-") : value;
}

function resolveStatusTone(value: string): CredentialModel["statusTone"] {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (["verified", "active", "approved", "compliant"].includes(normalized)) return "verified";
  if (["suspended", "rejected", "revoked", "flagged"].includes(normalized)) return "suspended";
  return "pending_review";
}

function statusBadgeCopy(model: Pick<CredentialModel, "displayStatus" | "statusTone">) {
  if (model.statusTone === "verified") return model.displayStatus || "Verified";
  if (model.statusTone === "suspended") return model.displayStatus || "Suspended";
  return model.displayStatus || "Pending Review";
}

function ownerInitials(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || "DB";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
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

async function waitForCanvasTarget(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    throw new Error("Export surface is unavailable.");
  }

  if (typeof document !== "undefined" && "fonts" in document) {
    await document.fonts.ready;
  }
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

async function toJpegBlob(canvas: HTMLCanvasElement, quality = 0.95) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to generate JPEG data."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

function bytes(value: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(value);
  const normalized = new Uint8Array(encoded.length);
  normalized.set(encoded);
  return normalized;
}

async function buildPdfFromJpeg(jpegBlob: Blob, imageWidth: number, imageHeight: number, fileName: string) {
  const imageBuffer = await jpegBlob.arrayBuffer();
  const imageBytes = new Uint8Array(imageBuffer) as Uint8Array<ArrayBuffer>;

  const margin = 24;
  const usableW = A4_PORTRAIT_WIDTH_PT - margin * 2;
  const usableH = A4_PORTRAIT_HEIGHT_PT - margin * 2;
  const scale = Math.min(usableW / imageWidth, usableH / imageHeight);
  const drawW = imageWidth * scale;
  const drawH = imageHeight * scale;
  const drawX = (A4_PORTRAIT_WIDTH_PT - drawW) / 2;
  const drawY = (A4_PORTRAIT_HEIGHT_PT - drawH) / 2;

  const stream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ\n`;

  const objects: Array<{ id: number; head: string; streamBytes?: Uint8Array<ArrayBuffer> }> = [
    { id: 1, head: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, head: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      id: 3,
      head: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PORTRAIT_WIDTH_PT.toFixed(2)} ${A4_PORTRAIT_HEIGHT_PT.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`,
    },
    {
      id: 4,
      head: `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>`,
      streamBytes: imageBytes,
    },
    { id: 5, head: `<< /Length ${bytes(stream).length} >>`, streamBytes: bytes(stream) },
    { id: 6, head: `<< /Title (${fileName.replace(/[()\\]/g, "")}) >>` },
  ];

  const header = bytes("%PDF-1.4\n");
  const parts: BlobPart[] = [header];
  const xref: number[] = [0];
  let offset = header.length;

  for (const object of objects) {
    xref.push(offset);
    const objHeader = bytes(`${object.id} 0 obj\n${object.head}\n`);
    parts.push(objHeader);
    offset += objHeader.length;

    if (object.streamBytes) {
      const streamStart = bytes("stream\n");
      const streamEnd = bytes("\nendstream\n");
      parts.push(streamStart, object.streamBytes, streamEnd);
      offset += streamStart.length + object.streamBytes.length + streamEnd.length;
    }

    const objEnd = bytes("endobj\n");
    parts.push(objEnd);
    offset += objEnd.length;
  }

  const xrefStart = offset;
  let xrefText = `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < xref.length; index += 1) {
    xrefText += `${String(xref[index]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${xref.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(bytes(xrefText), bytes(trailer));

  const pdfBlob = new Blob(parts, { type: "application/pdf" });
  downloadBlob(pdfBlob, fileName);
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#052e1f");
  gradient.addColorStop(0.55, "#065f46");
  gradient.addColorStop(1, "#064e3b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 10; i += 1) {
    ctx.strokeStyle = `rgba(167,243,208,${0.09 - i * 0.006})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-120, 40 + i * 90);
    ctx.bezierCurveTo(width * 0.3, 20 + i * 80, width * 0.76, 100 + i * 86, width + 130, 54 + i * 86);
    ctx.stroke();
  }
}

function drawSingleLineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  const content = text || "Not provided";
  if (ctx.measureText(content).width <= maxWidth) {
    ctx.fillText(content, x, y);
    return;
  }

  const ellipsis = "…";
  let trimmed = content;
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}${ellipsis}`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  ctx.fillText(`${trimmed}${ellipsis}`, x, y);
}

function drawCenteredSingleLineText(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, maxWidth: number) {
  const content = text || "Not provided";
  let display = content;
  const ellipsis = "…";
  while (display.length > 0 && ctx.measureText(display).width > maxWidth) {
    display = display.slice(0, -1);
  }
  const finalText = display.length < content.length ? `${display}${ellipsis}` : display;
  ctx.fillText(finalText, centerX, y);
}

function drawDbinSeal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const center = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#047857";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.strokeStyle = "#065f46";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center, center, center - 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#065f46";
  ctx.font = `800 ${Math.round(size * 0.2)}px Inter, Arial`;
  ctx.textAlign = "center";
  ctx.fillText("DBIN", center, center + 6);
  ctx.font = `700 ${Math.round(size * 0.075)}px Inter, Arial`;
  ctx.fillText("VERIFIED", center, center + size * 0.24);
  ctx.restore();
  ctx.textAlign = "left";
}

function drawStatusPill(ctx: CanvasRenderingContext2D, model: CredentialModel, x: number, y: number) {
  const label = statusBadgeCopy(model);
  const styles = {
    verified: { bg: "#dcfce7", text: "#047857" },
    pending_review: { bg: "#fef3c7", text: "#92400e" },
    suspended: { bg: "#fee2e2", text: "#b91c1c" },
  }[model.statusTone];
  ctx.font = "600 20px Inter, Arial";
  const width = Math.max(ctx.measureText(label).width + 32, 104);
  ctx.fillStyle = styles.bg;
  ctx.beginPath();
  ctx.roundRect(x, y, width, 38, 12);
  ctx.fill();
  ctx.fillStyle = styles.text;
  ctx.fillText(label, x + 16, y + 25);
}

function drawInfoPanel(ctx: CanvasRenderingContext2D, model: CredentialModel, x: number, y: number, width: number) {
  const rows = [
    ["Business ID:", model.businessId],
    ["Business Name:", model.businessName],
    ["Business Category:", model.businessCategory],
    ["Status:", statusBadgeCopy(model)],
    ["Expiry Date:", model.expiryDate],
  ];

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.roundRect(x, y, width, 250, 18);
  ctx.fill();

  rows.forEach(([label, value], index) => {
    const rowY = y + 42 + index * 42;
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 18px Inter, Arial";
    ctx.fillText(label, x + 34, rowY);
    if (label === "Status:") {
      drawStatusPill(ctx, model, x + 250, rowY - 26);
      return;
    }
    ctx.fillStyle = "#111827";
    ctx.font = "500 18px Inter, Arial";
    drawSingleLineText(ctx, value, x + 250, rowY, width - 284);
  });
}

async function drawPhoto(
  ctx: CanvasRenderingContext2D,
  photoUrl: string | null | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.clip();

  if (photoUrl) {
    try {
      const photo = await loadImage(photoUrl);
      ctx.drawImage(photo, x, y, width, height);
      ctx.restore();
      return;
    } catch {
      // fallback placeholder below
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#d1fae5";
  ctx.font = "600 20px Inter, Arial";
  ctx.fillText("Logo/photo unavailable", x + 20, y + height / 2);
  ctx.restore();
}

async function drawPocketCard(ctx: CanvasRenderingContext2D, model: CredentialModel) {
  await drawVerticalCredential(ctx, model, POCKET_CARD_WIDTH_PX, POCKET_CARD_HEIGHT_PX);
}

async function drawFullCredential(ctx: CanvasRenderingContext2D, model: CredentialModel) {
  await drawVerticalCredential(ctx, model, FULL_EXPORT_WIDTH, FULL_EXPORT_HEIGHT);
}

async function drawVerticalCredential(ctx: CanvasRenderingContext2D, model: CredentialModel, width: number, height: number) {
  drawBackground(ctx, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(18, 18, width - 36, height - 36, 22);
  ctx.fill();

  drawDbinSeal(ctx, 78, 62, 82);
  ctx.fillStyle = "#064e3b";
  ctx.font = "800 30px Inter, Arial";
  drawSingleLineText(ctx, model.associationName, 190, 94, width - 250);
  ctx.font = "500 22px Inter, Arial";
  ctx.fillStyle = "#6b7280";
  ctx.fillText(model.profileSubtitle, 190, 128);

  const photoW = 220;
  const photoH = 250;
  const photoX = (width - photoW) / 2;
  const photoY = 174;
  ctx.strokeStyle = "#047857";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(photoX - 3, photoY - 3, photoW + 6, photoH + 6, 18);
  ctx.stroke();
  await drawPhoto(ctx, model.passportPhotoUrl, photoX, photoY, photoW, photoH, 15);

  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = "800 30px Inter, Arial";
  drawCenteredSingleLineText(ctx, model.ownerName, width / 2, 482, 600);
  ctx.fillStyle = "#047857";
  ctx.font = "500 21px Inter, Arial";
  drawCenteredSingleLineText(ctx, model.memberSubtitle, width / 2, 516, 600);
  ctx.textAlign = "left";

  drawInfoPanel(ctx, model, 78, 548, width - 156);

  const qr = await loadImage(model.qrDataUrl);
  const qrFrame = 174;
  const qrX = (width - qrFrame) / 2;
  const qrY = 828;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qrFrame, qrFrame, 12);
  ctx.fill();
  ctx.stroke();
  ctx.drawImage(qr, qrX + 14, qrY + 14, qrFrame - 28, qrFrame - 28);
  ctx.textAlign = "center";
  ctx.fillStyle = "#6b7280";
  ctx.font = "500 18px Inter, Arial";
  ctx.fillText("Scan to verify", width / 2, qrY + qrFrame + 32);

  ctx.fillStyle = "#006b3f";
  ctx.beginPath();
  ctx.roundRect(64, height - 82, width - 128, 58, 12);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 24px Inter, Arial";
  ctx.fillText("Powered by DBIN", width / 2, height - 45);
  ctx.textAlign = "left";
}

export function DigitalIdWorkspace(props: DigitalIdWorkspaceProps) {
  const [busy, setBusy] = useState<"none" | "pdf" | "png" | "share">("none");
  const [notice, setNotice] = useState<Notice | null>(null);
  const fullCredentialExportRef = useRef<HTMLCanvasElement>(null);
  const pocketCredentialExportRef = useRef<HTMLCanvasElement>(null);

  const model = useMemo<CredentialModel>(() => {
    const displayStatus = formatStatus(props.verificationStatus || "pending_review");
    const statusTone = resolveStatusTone(props.verificationStatus || "pending_review");
    const associationName = props.associationName?.trim() || "DBIN Verified Business";

    return {
      associationName,
      profileSubtitle: props.associationName ? "Business Profile" : "Verified Business Profile",
      memberSubtitle: props.associationName ? `${associationName} Member` : "DBIN Verified Business",
      businessName: props.businessName || "Not provided",
      ownerName: props.ownerName || "Not provided",
      ownerEmail: props.ownerEmail || "Not provided",
      businessCategory: props.businessCategory || "Unspecified",
      businessType: props.businessType || "Unspecified",
      cacNumber: props.cacNumber || "Not provided",
      phoneNumber: props.phoneNumber || "Not provided",
      businessAddress: props.businessAddress || "Not provided",
      businessId: normalizeBusinessId(props.msmeId),
      displayStatus,
      statusTone,
      expiryDate: "April 2027",
      passportPhotoUrl: props.passportPhotoUrl,
      verifyUrl: props.verifyUrl,
      qrDataUrl: props.qrDataUrl,
    };
  }, [props]);

  const shareCard = useCallback(async () => {
    setBusy("share");
    setNotice(null);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Digital Business Identity Network (DBIN) Credential",
          text: "Verify this business identity on Digital Business Identity Network (DBIN).",
          url: model.verifyUrl,
        });

        setNotice({ tone: "success", message: "Credential shared successfully." });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(model.verifyUrl);
        setNotice({ tone: "success", message: "Verification link copied to clipboard." });
        return;
      }

      setNotice({ tone: "info", message: "Copy this verification link manually." });
    } catch (error) {
      console.error("[business-identity-share][failed]", error);

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(model.verifyUrl);
          setNotice({ tone: "success", message: "Verification link copied to clipboard." });
          return;
        }
      } catch (clipboardError) {
        console.error("[business-identity-share][failed]", clipboardError);
      }

      setNotice({ tone: "info", message: "Copy this verification link manually." });
    } finally {
      setBusy("none");
    }
  }, [model.verifyUrl]);

  const downloadPocketPng = useCallback(async () => {
    setBusy("png");
    setNotice(null);

    try {
      await waitForCanvasTarget(pocketCredentialExportRef.current);
      const canvas = pocketCredentialExportRef.current;
      if (!canvas) {
        throw new Error("Pocket export surface missing.");
      }

      canvas.width = POCKET_CARD_WIDTH_PX;
      canvas.height = POCKET_CARD_HEIGHT_PX;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        throw new Error("Unable to initialize PNG renderer.");
      }

      await drawPocketCard(ctx, model);
      const pngBlob = await toPngBlob(canvas);
      downloadBlob(pngBlob, "credential-idcard.png");
      setNotice({ tone: "success", message: "Wallet ID Card PNG downloaded." });
    } catch (error) {
      console.error("[business-identity-export][png_failed]", error);
      setNotice({ tone: "error", message: "Could not generate pocket PNG. Please retry." });
    } finally {
      setBusy("none");
    }
  }, [model]);

  const downloadPdf = useCallback(async () => {
    setBusy("pdf");
    setNotice(null);

    try {
      await waitForCanvasTarget(fullCredentialExportRef.current);
      const canvas = fullCredentialExportRef.current;
      if (!canvas) {
        throw new Error("PDF export surface missing.");
      }

      canvas.width = FULL_EXPORT_WIDTH;
      canvas.height = FULL_EXPORT_HEIGHT;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        throw new Error("Unable to initialize PDF renderer.");
      }

      await drawFullCredential(ctx, model);
      const jpegBlob = await toJpegBlob(canvas, 0.95);
      const safeId = sanitizeFileSegment(model.businessId || "credential");
      await buildPdfFromJpeg(jpegBlob, FULL_EXPORT_WIDTH, FULL_EXPORT_HEIGHT, `business-identity-network-${safeId}-credential.pdf`);
      setNotice({ tone: "success", message: "Credential PDF downloaded." });
    } catch (error) {
      console.error("[business-identity-export][pdf_failed]", error);
      setNotice({ tone: "error", message: "Could not generate PDF. Please retry." });
    } finally {
      setBusy("none");
    }
  }, [model]);

  return (
    <section className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">{statusBadgeCopy(model)} MSME</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My Business Identity Credential</h1>
        </div>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          <button
            type="button"
            onClick={shareCard}
            disabled={busy !== "none"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 sm:w-auto"
          >
            <Share2 className="h-4 w-4" /> {busy === "share" ? "Sharing..." : "Share Credential"}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={busy !== "none"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:opacity-60 sm:w-auto"
          >
            <Download className="h-4 w-4" /> {busy === "pdf" ? "Preparing PDF..." : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={downloadPocketPng}
            disabled={busy !== "none"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:opacity-60 sm:w-auto"
          >
            <Download className="h-4 w-4" /> {busy === "png" ? "Preparing PNG..." : "Download ID Card (Wallet Size)"}
          </button>
        </div>
      </header>

      {notice ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : notice.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      <article className="relative overflow-hidden rounded-2xl border border-emerald-900/20 bg-[linear-gradient(135deg,#052e1f,#065f46)] p-3 shadow-2xl sm:p-6">
        <div className="mx-auto w-full max-w-[25rem] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-emerald-900/10 sm:p-7" id="msme-id-card-full-view">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-emerald-700 bg-white text-sm font-black text-emerald-800 shadow-sm">
              DBIN
            </div>
            <div className="min-w-0 pt-1">
              <h2 className="text-balance text-xl font-extrabold leading-tight text-emerald-950">{model.associationName}</h2>
              <p className="mt-1 text-base text-slate-500">{model.profileSubtitle}</p>
            </div>
          </div>

          <div className="mt-7 flex justify-center">
            <div className="rounded-2xl border-2 border-emerald-700 bg-white p-1 shadow-sm">
              <PassportPhoto
                src={model.passportPhotoUrl}
                alt="Business owner or representative photo"
                className="h-44 w-36 rounded-xl object-cover sm:h-48 sm:w-40"
                placeholderClassName="flex h-44 w-36 items-center justify-center rounded-xl bg-emerald-50 text-3xl font-bold text-emerald-800 sm:h-48 sm:w-40"
                placeholderText={ownerInitials(model.ownerName)}
              />
            </div>
          </div>

          <div className="mt-6 text-center">
            <h3 className="text-balance text-2xl font-extrabold leading-tight text-slate-950">{model.ownerName}</h3>
            <p className="mt-2 text-base font-medium text-emerald-800">{model.memberSubtitle}</p>
          </div>

          <dl className="mt-6 space-y-4 rounded-xl bg-slate-50 px-5 py-5 text-sm shadow-inner">
            {[
              ["Business ID:", model.businessId],
              ["Business Name:", model.businessName],
              ["Business Category:", model.businessCategory],
              ["Status:", statusBadgeCopy(model)],
              ["Expiry Date:", model.expiryDate],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[9rem_1fr] items-start gap-2">
                <dt className="font-bold text-slate-950">{label}</dt>
                <dd className="min-w-0 text-slate-900">
                  {label === "Status:" ? (
                    <span
                      className={`inline-flex rounded-md px-2.5 py-1 text-sm font-semibold ${
                        model.statusTone === "verified"
                          ? "bg-emerald-100 text-emerald-800"
                          : model.statusTone === "suspended"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {value}
                    </span>
                  ) : (
                    <span className="break-words">{value}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-col items-center">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <img src={model.qrDataUrl} alt="Verification QR" className="h-36 w-36" />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-500">Scan to verify</p>
          </div>

          <div className="mt-4 rounded-xl bg-emerald-800 px-4 py-3 text-center text-base font-semibold text-white shadow-sm">
            Powered by DBIN
          </div>
        </div>
      </article>

      <div
        aria-hidden="true"
        className="fixed -left-[12000px] top-0 z-[-1] overflow-hidden opacity-0 pointer-events-none"
        style={{ width: `${POCKET_CARD_WIDTH_PX}px`, height: `${POCKET_CARD_HEIGHT_PX}px` }}
      >
        <canvas ref={pocketCredentialExportRef} width={POCKET_CARD_WIDTH_PX} height={POCKET_CARD_HEIGHT_PX} />
      </div>

      <div
        aria-hidden="true"
        className="fixed -left-[12000px] top-0 z-[-1] overflow-hidden opacity-0 pointer-events-none"
        style={{ width: `${FULL_EXPORT_WIDTH}px`, height: `${FULL_EXPORT_HEIGHT}px` }}
      >
        <canvas ref={fullCredentialExportRef} width={FULL_EXPORT_WIDTH} height={FULL_EXPORT_HEIGHT} />
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
        <p className="inline-flex items-center gap-2 font-medium text-slate-800"><CheckCircle2 className="h-4 w-4 text-emerald-700" /> This credential confirms that the business profile has been registered and validated within the Digital Business Identity Network (DBIN).</p>
        <p className="mt-1 text-xs text-slate-500">Digital Business Identity Network (DBIN) is an independent business identity and verification network designed to support partnerships with public institutions, associations, lenders, and marketplaces.</p>
      </div>
    </section>
  );
}
