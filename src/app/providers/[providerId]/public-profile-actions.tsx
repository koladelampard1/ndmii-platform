"use client";

import { useState } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";

type PublicProfileActionsProps = {
  profileUrl: string;
  verificationSummaryUrl: string | null;
};

export function PublicProfileActions({ profileUrl, verificationSummaryUrl }: PublicProfileActionsProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const shareProfile = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "BIN Business Profile",
          text: "View this verified business profile on BIN",
          url: profileUrl,
        });
        return;
      }
    } catch {
      // Clipboard fallback handled below.
    }

    await copyLink();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 break-all">{profileUrl}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy Link"}
        </button>
        <button
          type="button"
          onClick={() => void shareProfile()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
      {verificationSummaryUrl ? (
        <a
          href={verificationSummaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          <Download className="h-4 w-4" />
          Download Verification Summary (PDF)
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
          title="Verification summary is unavailable for this profile"
        >
          <Download className="h-4 w-4" />
          Verification Summary Unavailable
        </button>
      )}
    </div>
  );
}
