"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type PassportPhotoProps = {
  src?: string | null;
  alt: string;
  className: string;
  placeholderClassName: string;
  placeholderText?: string;
  placeholder?: ReactNode;
};

export function PassportPhoto({ src, alt, className, placeholderClassName, placeholderText = "N", placeholder }: PassportPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const normalizedSrc = src?.trim() || null;
  const failed = normalizedSrc ? failedSrc === normalizedSrc : false;

  if (!normalizedSrc || failed) {
    return <div className={placeholderClassName}>{placeholder ?? placeholderText}</div>;
  }

  return <img src={normalizedSrc} alt={alt} className={className} onError={() => setFailedSrc(normalizedSrc)} />;
}
