import Image from "next/image";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type QRCodeVerificationPanelProps = {
  qrDataUrl: string;
  verificationUrl: string;
  issueDate: string;
};

export function QRCodeVerificationPanel({ qrDataUrl, verificationUrl, issueDate }: QRCodeVerificationPanelProps) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
        <Image src={qrDataUrl} alt="Verification QR code" width={160} height={160} unoptimized className="mx-auto h-40 w-40" />
        <p className="mt-3 text-xs font-medium text-slate-700">Verification URL</p>
        <p className="mt-1 break-all text-xs text-emerald-700">{verificationUrl}</p>
        <p className="mt-2 text-xs text-slate-500">Issued on: {issueDate}</p>
      </div>
      <div className="mt-4 space-y-2">
        <Button variant="secondary" className="w-full border border-slate-300 bg-white" type="button">
          <Download className="mr-2 h-4 w-4" />
          Download Verification Summary (PDF)
        </Button>
        <Button variant="secondary" className="w-full border border-slate-300 bg-white" type="button">
          <Share2 className="mr-2 h-4 w-4" />
          Share Verification Link
        </Button>
      </div>
    </aside>
  );
}
