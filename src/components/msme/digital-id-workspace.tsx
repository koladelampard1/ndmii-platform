"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type CredentialModel = {
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

const A4_LANDSCAPE_WIDTH_PT = 841.89;
const A4_LANDSCAPE_HEIGHT_PT = 595.28;
const FULL_EXPORT_WIDTH = 1120;
const FULL_EXPORT_HEIGHT = 700;
const POCKET_CARD_WIDTH_PX = 1013;
const POCKET_CARD_HEIGHT_PX = 638;

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
  if (normalized === "verified") return "verified";
  if (normalized === "suspended") return "suspended";
  return "pending_review";
}

function statusBadgeCopy(statusTone: CredentialModel["statusTone"]) {
  if (statusTone === "verified") return "Verified";
  if (statusTone === "suspended") return "Suspended";
  return "Pending Review";
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
  const usableW = A4_LANDSCAPE_WIDTH_PT - margin * 2;
  const usableH = A4_LANDSCAPE_HEIGHT_PT - margin * 2;
  const scale = Math.min(usableW / imageWidth, usableH / imageHeight);
  const drawW = imageWidth * scale;
  const drawH = imageHeight * scale;
  const drawX = (A4_LANDSCAPE_WIDTH_PT - drawW) / 2;
  const drawY = (A4_LANDSCAPE_HEIGHT_PT - drawH) / 2;

  const stream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ\n`;

  const objects: Array<{ id: number; head: string; streamBytes?: Uint8Array<ArrayBuffer> }> = [
    { id: 1, head: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, head: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      id: 3,
      head: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LANDSCAPE_WIDTH_PT.toFixed(2)} ${A4_LANDSCAPE_HEIGHT_PT.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`,
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
  drawBackground(ctx, POCKET_CARD_WIDTH_PX, POCKET_CARD_HEIGHT_PX);

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "right";
  ctx.font = "900 50px Inter, Arial";
  ctx.fillText("BIN", POCKET_CARD_WIDTH_PX - 34, 62);
  ctx.textAlign = "left";

  await drawPhoto(ctx, model.passportPhotoUrl, 38, 86, 180, 252, 14);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 16px Inter, Arial";
  ctx.fillText("BUSINESS NAME", 244, 124);
  ctx.font = "700 34px Inter, Arial";
  drawSingleLineText(ctx, model.businessName, 244, 160, 420);
  ctx.font = "700 16px Inter, Arial";
  ctx.fillText("OWNER NAME", 244, 204);
  ctx.font = "700 27px Inter, Arial";
  drawSingleLineText(ctx, model.ownerName, 244, 236, 420);
  ctx.font = "700 16px Inter, Arial";
  ctx.fillText("STATUS", 244, 280);
  ctx.font = "700 27px Inter, Arial";
  ctx.fillStyle = model.statusTone === "verified" ? "#86efac" : model.statusTone === "suspended" ? "#fca5a5" : "#fde68a";
  drawSingleLineText(ctx, statusBadgeCopy(model.statusTone), 244, 312, 420);

  const qr = await loadImage(model.qrDataUrl);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(785, 106, 190, 190);
  ctx.drawImage(qr, 793, 114, 174, 174);
  ctx.fillStyle = "#dcfce7";
  ctx.font = "700 20px Inter, Arial";
  ctx.fillText("Scan to verify", 800, 334);

  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.fillRect(32, 376, POCKET_CARD_WIDTH_PX - 64, 118);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 16px Inter, Arial";
  ctx.fillText("BUSINESS ID", 50, 420);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px Inter, Arial";
  drawSingleLineText(ctx, model.businessId, 50, 452, 520);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 16px Inter, Arial";
  ctx.fillText("EXPIRY DATE", 610, 420);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px Inter, Arial";
  drawSingleLineText(ctx, model.expiryDate, 610, 452, 280);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, POCKET_CARD_HEIGHT_PX - 56, POCKET_CARD_WIDTH_PX, 56);
  ctx.fillStyle = "#ecfdf5";
  ctx.font = "700 20px Inter, Arial";
  ctx.fillText("BIN Verified • Trusted • Shareable", 38, POCKET_CARD_HEIGHT_PX - 22);
}

async function drawFullCredential(ctx: CanvasRenderingContext2D, model: CredentialModel) {
  drawBackground(ctx, FULL_EXPORT_WIDTH, FULL_EXPORT_HEIGHT);
  const pad = 32;
  const cardW = FULL_EXPORT_WIDTH - pad * 2;
  const cardH = FULL_EXPORT_HEIGHT - pad * 2;
  const cardX = pad;
  const cardY = pad;

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(cardX, cardY, cardW, cardH);

  ctx.fillStyle = "#ecfdf5";
  ctx.font = "700 46px Inter, Arial";
  ctx.fillText("BIN", cardX + 26, cardY + 56);
  ctx.font = "700 34px Inter, Arial";
  ctx.fillText("Verified Business Identity Credential", cardX + 150, cardY + 56);

  const statusStyles = {
    verified: { bg: "#34d399", text: "#064e3b" },
    pending_review: { bg: "#f59e0b", text: "#422006" },
    suspended: { bg: "#ef4444", text: "#ffffff" },
  }[model.statusTone];
  const badgeW = 210;
  const badgeH = 38;
  const badgeX = cardX + cardW - badgeW - 24;
  const badgeY = cardY + 18;
  ctx.fillStyle = statusStyles.bg;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 19);
  ctx.fill();
  ctx.fillStyle = statusStyles.text;
  ctx.font = "700 20px Inter, Arial";
  ctx.textAlign = "center";
  ctx.fillText(statusBadgeCopy(model.statusTone), badgeX + badgeW / 2, badgeY + 26);
  ctx.textAlign = "left";

  const topOffset = 94;
  const stripH = 62;
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(cardX + 20, cardY + cardH - stripH - 18, cardW - 40, stripH);
  ctx.fillStyle = "#ecfdf5";
  ctx.font = "700 30px Inter, Arial";
  ctx.fillText("BIN Verified • Trusted • Shareable", cardX + 40, cardY + cardH - 42);

  const contentY = cardY + topOffset;
  const contentH = cardH - topOffset - stripH - 30;
  const leftW = 260;
  const centerW = 470;
  const rightW = 260;
  const colGap = 26;
  const leftX = cardX + 24;
  const centerX = leftX + leftW + colGap;
  const rightX = centerX + centerW + colGap;

  await drawPhoto(ctx, model.passportPhotoUrl, leftX, contentY + 8, 236, 290, 16);
  ctx.fillStyle = "#a7f3d0";
  ctx.font = "600 15px Inter, Arial";
  ctx.fillText("BUSINESS CATEGORY", leftX, contentY + 334);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 25px Inter, Arial";
  drawSingleLineText(ctx, model.businessCategory, leftX, contentY + 364, leftW - 20);
  ctx.fillStyle = "#a7f3d0";
  ctx.font = "600 15px Inter, Arial";
  ctx.fillText("BUSINESS TYPE", leftX, contentY + 402);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 25px Inter, Arial";
  drawSingleLineText(ctx, model.businessType, leftX, contentY + 432, leftW - 20);

  const row = (label: string, value: string, y: number) => {
    ctx.fillStyle = "rgba(236,253,245,0.7)";
    ctx.font = "600 15px Inter, Arial";
    ctx.fillText(label.toUpperCase(), centerX, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = label === "Business Name" ? "600 40px Inter, Arial" : "500 30px Inter, Arial";
    drawSingleLineText(ctx, value, centerX, y + 36, centerW - 10);
  };
  row("Business Name", model.businessName, contentY + 22);
  row("Owner Name", model.ownerName, contentY + 104);
  row("Business ID", model.businessId, contentY + 186);
  row("Status", statusBadgeCopy(model.statusTone), contentY + 268);
  row("Expiry Date", model.expiryDate, contentY + 350);

  const qr = await loadImage(model.qrDataUrl);
  const qrSize = 196;
  const qrFrame = 212;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(rightX + rightW - qrFrame, contentY + 42, qrFrame, qrFrame);
  ctx.drawImage(qr, rightX + rightW - qrFrame + 8, contentY + 50, qrSize, qrSize);
  ctx.fillStyle = "#dcfce7";
  ctx.font = "700 24px Inter, Arial";
  ctx.textAlign = "right";
  ctx.fillText("Scan to verify", rightX + rightW, contentY + 282);
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

    return {
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
          title: "Business Identity Network Credential",
          text: "Verify this business identity on Business Identity Network.",
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
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">{statusBadgeCopy(model.statusTone)} MSME</p>
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

      <article className="relative overflow-x-auto rounded-2xl border border-emerald-300/20 bg-[linear-gradient(135deg,#063C2E,#0A5F47)] p-4 shadow-2xl ring-1 ring-white/20 sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-10 [background:repeating-linear-gradient(135deg,rgba(255,255,255,.14)_0_2px,transparent_2px_16px)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_80%_22%,#fff_0,transparent_38%),radial-gradient(circle_at_88%_78%,#fff_0,transparent_26%)]" />
        <div className="pointer-events-none absolute bottom-6 right-6 h-28 w-28 rounded-full border border-emerald-100/20 bg-white/5 sm:h-44 sm:w-44" />

        <div className="relative z-10" id="msme-id-card-full-view">
          <div className="mx-auto h-[700px] w-[1120px] rounded-2xl border border-emerald-100/20 bg-black/20 p-8 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-4xl font-bold text-emerald-100">BIN</p>
                <p className="text-4xl font-bold text-white">Verified Business Identity Credential</p>
              </div>
              <span
                className={`rounded-full px-4 py-1 text-base font-bold ${
                  model.statusTone === "verified"
                    ? "bg-emerald-300 text-emerald-950"
                    : model.statusTone === "suspended"
                      ? "bg-rose-500 text-white"
                      : "bg-amber-400 text-amber-950"
                }`}
              >
                {statusBadgeCopy(model.statusTone)}
              </span>
            </div>

            <div className="mt-8 grid h-[520px] grid-cols-[260px_1fr_260px] gap-6">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-emerald-100/40 bg-black/20 p-1">
                  <PassportPhoto
                    src={model.passportPhotoUrl}
                    alt="Business logo or representative photo"
                    className="h-[310px] w-full rounded-xl object-cover"
                    placeholderClassName="flex h-[310px] flex-col items-center justify-center rounded-xl bg-black/30 text-emerald-100"
                    placeholderText="Photo/logo unavailable"
                  />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wide opacity-70 text-emerald-100">Business category</p>
                  <p className="truncate text-lg font-medium text-white">{model.businessCategory}</p>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wide opacity-70 text-emerald-100">Business type</p>
                  <p className="truncate text-lg font-medium text-white">{model.businessType}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm uppercase tracking-wide opacity-70 text-emerald-100">Business name</p>
                  <p className="truncate text-3xl font-semibold text-white">{model.businessName}</p>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wide opacity-70 text-emerald-100">Owner name</p>
                  <p className="truncate text-lg font-medium text-white">{model.ownerName}</p>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wide opacity-70 text-emerald-100">Business ID</p>
                  <p className="truncate text-lg font-medium text-white">{model.businessId}</p>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wide opacity-70 text-emerald-100">Status</p>
                  <p className="text-lg font-medium text-white">{statusBadgeCopy(model.statusTone)}</p>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wide opacity-70 text-emerald-100">Expiry date</p>
                  <p className="text-lg font-medium text-white">{model.expiryDate}</p>
                </div>
              </div>

              <div className="flex flex-col items-end justify-start pt-6">
                <div className="rounded-xl bg-white p-3">
                  <img src={model.qrDataUrl} alt="Verification QR" className="h-[180px] w-[180px]" />
                </div>
                <p className="mt-3 text-lg font-medium text-emerald-50">Scan to verify</p>
              </div>
            </div>

            <div className="mt-2 rounded-xl bg-black/25 px-5 py-3 text-lg font-medium text-emerald-50">
              BIN Verified • Trusted • Shareable
            </div>
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
        <p className="inline-flex items-center gap-2 font-medium text-slate-800"><CheckCircle2 className="h-4 w-4 text-emerald-700" /> This credential confirms that the business profile has been registered and validated within the Business Identity Network.</p>
        <p className="mt-1 text-xs text-slate-500">Business Identity Network is an independent business identity and verification network designed to support partnerships with public institutions, associations, lenders, and marketplaces.</p>
      </div>
    </section>
  );
}
