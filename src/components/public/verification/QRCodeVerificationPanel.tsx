"use client";

import Image from "next/image";
import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";

type QRCodeVerificationPanelProps = {
  qrDataUrl: string;
  verificationUrl: string;
  issueDate: string;
  businessId: string;
};

export function QRCodeVerificationPanel({ qrDataUrl, verificationUrl, issueDate, businessId }: QRCodeVerificationPanelProps) {
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const handleDownload = () => {
    window.open(`/api/verification-summary/${encodeURIComponent(businessId)}`, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "BIN Business Verification",
          text: "Verify this business identity credential on BIN",
          url: verificationUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(verificationUrl);
        setShowCopiedToast(true);
      }
    } catch {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(verificationUrl);
        setShowCopiedToast(true);
      }
    }
  };

  return (
    <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
        <Image src={qrDataUrl} alt="Verification QR code" width={160} height={160} unoptimized className="mx-auto h-40 w-40" />
        <p className="mt-3 text-xs font-medium text-slate-700">Verification URL</p>
        <p className="mt-1 break-all text-xs text-emerald-700">{verificationUrl}</p>
        <p className="mt-2 text-xs text-slate-500">Issued on: {issueDate}</p>
      </div>
      <div className="mt-4 space-y-2">
        <Button variant="secondary" className="w-full border border-slate-300 bg-white" type="button" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download Verification Summary (PDF)
        </Button>
        <Button variant="secondary" className="w-full border border-slate-300 bg-white" type="button" onClick={() => void handleShare()}>
          <Share2 className="mr-2 h-4 w-4" />
          Share Verification Link
        </Button>
      </div>
      <Toast
        open={showCopiedToast}
        message="Verification link copied"
        onClose={() => setShowCopiedToast(false)}
      />
    </aside>
  );
}
