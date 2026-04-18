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
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className={placeholderClassName}>{placeholder ?? placeholderText}</div>;
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}
