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
  isVerified: boolean;
  expiryDate: string;
  passportPhotoUrl?: string | null;
  verifyUrl: string;
  qrDataUrl: string;
};

const A4_LANDSCAPE_WIDTH_PT = 841.89;
const A4_LANDSCAPE_HEIGHT_PT = 595.28;
const FULL_EXPORT_WIDTH = 1800;
const FULL_EXPORT_HEIGHT = 1120;
const POCKET_CARD_WIDTH_PX = 1011;
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

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

async function buildPdfFromJpeg(jpegBlob: Blob, imageWidth: number, imageHeight: number, fileName: string) {
  const imageBuffer = await jpegBlob.arrayBuffer();
  const imageBytes = new Uint8Array(imageBuffer);

  const margin = 24;
  const usableW = A4_LANDSCAPE_WIDTH_PT - margin * 2;
  const usableH = A4_LANDSCAPE_HEIGHT_PT - margin * 2;
  const scale = Math.min(usableW / imageWidth, usableH / imageHeight);
  const drawW = imageWidth * scale;
  const drawH = imageHeight * scale;
  const drawX = (A4_LANDSCAPE_WIDTH_PT - drawW) / 2;
  const drawY = (A4_LANDSCAPE_HEIGHT_PT - drawH) / 2;

  const stream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ\n`;

  const objects: Array<{ id: number; head: string; streamBytes?: Uint8Array }> = [
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
  const parts: Uint8Array[] = [header];
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

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.font = "700 28px Inter, Arial";
  ctx.fillText("BUSINESS IDENTITY NETWORK", 38, 52);
  ctx.font = "800 24px Inter, Arial";
  ctx.fillStyle = "#d1fae5";
  ctx.fillText("Verified Business Identity Credential", 38, 82);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.textAlign = "right";
  ctx.font = "900 54px Inter, Arial";
  ctx.fillText("BIN", POCKET_CARD_WIDTH_PX - 34, 70);
  ctx.textAlign = "left";

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 42px Inter, Arial";
  ctx.fillText(model.businessName, 38, 138, 640);
  ctx.fillStyle = "#bbf7d0";
  ctx.font = "600 26px Inter, Arial";
  ctx.fillText(`${model.businessCategory} • ${model.businessType}`, 38, 172, 640);

  await drawPhoto(ctx, model.passportPhotoUrl, 38, 198, 180, 218, 14);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 17px Inter, Arial";
  ctx.fillText("BUSINESS ID", 242, 225);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 26px Inter, Arial";
  ctx.fillText(model.businessId, 242, 252, 370);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 17px Inter, Arial";
  ctx.fillText("OWNER", 242, 292);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 30px Inter, Arial";
  ctx.fillText(model.ownerName, 242, 322, 360);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 17px Inter, Arial";
  ctx.fillText("STATUS", 242, 364);
  ctx.fillStyle = model.isVerified ? "#86efac" : "#fde68a";
  ctx.font = "700 30px Inter, Arial";
  ctx.fillText(model.isVerified ? "BIN Verified" : "Pending Review", 242, 395);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 17px Inter, Arial";
  ctx.fillText("EXPIRY", 242, 436);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 25px Inter, Arial";
  ctx.fillText(model.expiryDate, 242, 466);

  const qr = await loadImage(model.qrDataUrl);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(803, 190, 164, 164);
  ctx.drawImage(qr, 811, 198, 148, 148);

  ctx.fillStyle = "#dcfce7";
  ctx.font = "700 20px Inter, Arial";
  ctx.fillText("Scan to verify", 810, 382);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, POCKET_CARD_HEIGHT_PX - 56, POCKET_CARD_WIDTH_PX, 56);
  ctx.fillStyle = "#ecfdf5";
  ctx.font = "700 20px Inter, Arial";
  ctx.fillText("BIN Verified • Trusted • Shareable", 38, POCKET_CARD_HEIGHT_PX - 22);
}

async function drawFullCredential(ctx: CanvasRenderingContext2D, model: CredentialModel) {
  drawBackground(ctx, FULL_EXPORT_WIDTH, FULL_EXPORT_HEIGHT);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px Inter, Arial";
  ctx.fillText("Business Identity Network", 68, 108);
  ctx.fillStyle = "#d1fae5";
  ctx.font = "600 34px Inter, Arial";
  ctx.fillText("Verified Business Identity Credential", 68, 152);

  ctx.fillStyle = model.isVerified ? "rgba(110,231,183,0.3)" : "rgba(253,230,138,0.26)";
  ctx.fillRect(FULL_EXPORT_WIDTH - 352, 58, 280, 62);
  ctx.fillStyle = model.isVerified ? "#bbf7d0" : "#fde68a";
  ctx.font = "700 30px Inter, Arial";
  ctx.fillText(model.isVerified ? "BIN Verified" : "Pending Review", FULL_EXPORT_WIDTH - 328, 99);

  await drawPhoto(ctx, model.passportPhotoUrl, 68, 206, 310, 390, 22);

  const panelX = 420;
  const panelY = 206;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(panelX, panelY, FULL_EXPORT_WIDTH - panelX - 68, 568);

  const rows: Array<[string, string]> = [
    ["Business Name", model.businessName],
    ["Owner Name", model.ownerName],
    ["Email", model.ownerEmail],
    ["Phone", model.phoneNumber],
    ["Business Category", model.businessCategory],
    ["Business Type", model.businessType],
    ["CAC Number", model.cacNumber],
    ["Business Address", model.businessAddress],
    ["Business ID", model.businessId],
    ["Expiry Date", model.expiryDate],
  ];

  let y = panelY + 56;
  for (const [label, value] of rows) {
    ctx.fillStyle = "#a7f3d0";
    ctx.font = "600 22px Inter, Arial";
    ctx.fillText(label, panelX + 28, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 30px Inter, Arial";
    ctx.fillText(value, panelX + 28, y + 34, 1230);
    y += 82;
  }

  const qr = await loadImage(model.qrDataUrl);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(68, 648, 188, 188);
  ctx.drawImage(qr, 76, 656, 172, 172);
  ctx.fillStyle = "#dcfce7";
  ctx.font = "700 26px Inter, Arial";
  ctx.fillText("Scan to verify this business identity", 280, 716);
  ctx.font = "500 22px Inter, Arial";
  ctx.fillText("BIN Verified • Trusted • Shareable", 280, 752);

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(68, 874, FULL_EXPORT_WIDTH - 136, 170);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "500 22px Inter, Arial";
  ctx.fillText(
    "Business Identity Network is an independent business identity and verification network designed to support",
    90,
    944,
  );
  ctx.fillText("partnerships with public institutions, associations, lenders, and marketplaces.", 90, 976);
}

function renderVisibleStatusBadge(isVerified: boolean) {
  return isVerified ? "BIN Verified" : "Pending Review";
}

export function DigitalIdWorkspace(props: DigitalIdWorkspaceProps) {
  const [busy, setBusy] = useState<"none" | "pdf" | "png" | "share">("none");
  const [notice, setNotice] = useState<Notice | null>(null);
  const fullCredentialExportRef = useRef<HTMLCanvasElement>(null);
  const pocketCredentialExportRef = useRef<HTMLCanvasElement>(null);

  const model = useMemo<CredentialModel>(() => {
    const displayStatus = formatStatus(props.verificationStatus || "pending_review");
    const isVerified = displayStatus.toLowerCase() === "verified";

    return {
      businessName: props.businessName || "Not provided",
      ownerName: props.ownerName || "Not provided",
      ownerEmail: props.ownerEmail || "Not provided",
      businessCategory: props.businessCategory || "Unspecified",
      businessType: props.businessType || "Unspecified",
      cacNumber: props.cacNumber || "Not provided",
      phoneNumber: props.phoneNumber || "Not provided",
      businessAddress: props.businessAddress || "Not provided",
      businessId: props.msmeId,
      displayStatus,
      isVerified,
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
      const safeId = sanitizeFileSegment(model.businessId || "credential");
      downloadBlob(pngBlob, `business-identity-network-${safeId}-pocket-id.png`);
      setNotice({ tone: "success", message: "Pocket ID PNG downloaded." });
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
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">
            {model.isVerified ? "Verified MSME" : "Pending MSME"}
          </p>
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

      <article className="relative overflow-hidden rounded-2xl border border-emerald-300/20 bg-[linear-gradient(135deg,#063C2E,#0A5F47)] p-4 shadow-2xl ring-1 ring-white/20 sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-10 [background:repeating-linear-gradient(135deg,rgba(255,255,255,.14)_0_2px,transparent_2px_16px)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_80%_22%,#fff_0,transparent_38%),radial-gradient(circle_at_88%_78%,#fff_0,transparent_26%)]" />
        <div className="pointer-events-none absolute bottom-6 right-6 h-28 w-28 rounded-full border border-emerald-100/20 bg-white/5 sm:h-44 sm:w-44" />

        <div className="relative z-10 space-y-4" id="msme-id-card-full-view">
          <div className="flex items-start justify-between gap-4 border-b border-white/20 pb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-100">Business Identity Network</p>
              <h2 className="mt-1 text-xl font-semibold text-white sm:text-5xl">Business Identity Network</h2>
              <p className="mt-1 text-sm text-emerald-50 sm:text-2xl">Verified Business Identity Credential</p>
            </div>
            <span
              className={`mt-1 inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur ${
                model.isVerified
                  ? "border-emerald-100/60 bg-emerald-300/20 text-emerald-50"
                  : "border-amber-100/60 bg-amber-300/20 text-amber-50"
              }`}
            >
              {renderVisibleStatusBadge(model.isVerified)}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-emerald-100/40 bg-black/20 p-1 backdrop-blur-sm">
                <PassportPhoto
                  src={model.passportPhotoUrl}
                  alt="Business logo or representative photo"
                  className="h-72 w-full rounded-xl object-cover"
                  placeholderClassName="flex h-72 flex-col items-center justify-center rounded-xl bg-black/30 text-emerald-100"
                  placeholderText="Photo/logo unavailable"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200/30 bg-black/15 p-4 backdrop-blur-sm sm:p-6">
              <p className="text-xs text-emerald-100/80">Business Name</p>
              <p className="text-2xl font-semibold text-white">{model.businessName}</p>

              <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-4 text-emerald-50 sm:grid-cols-2">
                <div><p className="text-xs text-emerald-100/80">Owner Name</p><p className="text-base font-medium">{model.ownerName}</p></div>
                <div><p className="text-xs text-emerald-100/80">Email</p><p className="text-base font-medium [overflow-wrap:anywhere]">{model.ownerEmail}</p></div>
                <div><p className="text-xs text-emerald-100/80">Business Category</p><p className="text-base font-medium">{model.businessCategory}</p></div>
                <div><p className="text-xs text-emerald-100/80">Business Type</p><p className="text-base font-medium">{model.businessType}</p></div>
                <div><p className="text-xs text-emerald-100/80">CAC Number</p><p className="text-base font-medium">{model.cacNumber}</p></div>
                <div><p className="text-xs text-emerald-100/80">Phone Number</p><p className="text-base font-medium">{model.phoneNumber}</p></div>
                <div className="sm:col-span-2"><p className="text-xs text-emerald-100/80">Business Address</p><p className="text-base font-medium">{model.businessAddress}</p></div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-emerald-200/35 bg-black/20 p-4 backdrop-blur sm:grid-cols-1 md:grid-cols-[1.2fr_1fr_0.9fr_0.7fr] md:items-center">
            <div className="flex items-center gap-3 border-emerald-100/25 md:border-r md:pr-4">
              <div className="rounded-lg bg-white p-1.5">
                <img src={model.qrDataUrl} alt="Verification QR" className="h-20 w-20" />
              </div>
              <div className="text-emerald-50">
                <p className="text-xs uppercase tracking-widest text-emerald-100">Scan to verify this business identity</p>
                <p className="text-sm">Instantly verify this credential on the Business Identity Network registry.</p>
              </div>
            </div>
            <div className="md:border-r md:border-emerald-100/25 md:pr-4">
              <p className="text-xs uppercase tracking-widest text-emerald-100">Business ID</p>
              <p className="text-2xl font-semibold text-white">{model.businessId}</p>
            </div>
            <div className="md:border-r md:border-emerald-100/25 md:pr-4">
              <p className="text-xs uppercase tracking-widest text-emerald-100">Status</p>
              <p className={`text-xl font-semibold ${model.isVerified ? "text-emerald-200" : "text-amber-200"}`}>
                {renderVisibleStatusBadge(model.isVerified)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-100">Expiry Date</p>
              <p className="text-2xl font-semibold text-white">{model.expiryDate}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/20 bg-black/25 px-4 py-3 text-xs text-emerald-50/95">
            Business Identity Network is an independent business identity and verification network designed to support partnerships with public institutions, associations, lenders, and marketplaces.
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
