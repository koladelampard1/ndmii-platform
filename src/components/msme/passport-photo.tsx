"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { classifyPassportPhotoValue, logPassportPhotoDiagnostic, type PassportPhotoValueType } from "@/lib/msme/passport-photo-diagnostics";

type PassportPhotoProps = {
  src?: string | null;
  alt: string;
  className: string;
  placeholderClassName: string;
  placeholderText?: string;
  placeholder?: ReactNode;
  diagnostics?: {
    msmeId?: string | null;
    persistedColumn?: "passport_photo_path" | "passport_photo_url" | "none";
    valueType?: PassportPhotoValueType;
    signedUrlGenerated?: boolean;
  };
};

export function PassportPhoto({ src, alt, className, placeholderClassName, placeholderText = "N", placeholder, diagnostics }: PassportPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const normalizedSrc = src?.trim() || null;
  const failed = normalizedSrc ? failedSrc === normalizedSrc : false;

  useEffect(() => {
    if (!diagnostics || (normalizedSrc && !failed)) return;
    logPassportPhotoDiagnostic("render", {
      msmeId: diagnostics.msmeId ?? null,
      persistedColumn: diagnostics.persistedColumn ?? "none",
      hasPassportValue: Boolean(normalizedSrc),
      valueType: diagnostics.valueType ?? classifyPassportPhotoValue(normalizedSrc),
      signedUrlGenerated: diagnostics.signedUrlGenerated ?? Boolean(normalizedSrc),
      renderFallback: true,
      supabaseError: null,
    });
  }, [diagnostics, failed, normalizedSrc]);

  if (!normalizedSrc || failed) {
    return <div className={placeholderClassName}>{placeholder ?? placeholderText}</div>;
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (diagnostics) {
          logPassportPhotoDiagnostic("render-error", {
            msmeId: diagnostics.msmeId ?? null,
            persistedColumn: diagnostics.persistedColumn ?? "none",
            hasPassportValue: true,
            valueType: diagnostics.valueType ?? classifyPassportPhotoValue(normalizedSrc),
            signedUrlGenerated: diagnostics.signedUrlGenerated ?? Boolean(normalizedSrc),
            renderFallback: true,
            supabaseError: null,
          });
        }
        setFailedSrc(normalizedSrc);
      }}
    />
  );
}
