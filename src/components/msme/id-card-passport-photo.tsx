"use client";

import { useEffect, useMemo, useState } from "react";

type IdCardPassportPhotoProps = {
  imageUrl: string | null | undefined;
  alt: string;
  fallbackText: string;
  imageClassName: string;
  fallbackClassName: string;
};

function normalizeImageUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;
  const normalized = imageUrl.trim();
  return normalized.length > 0 ? normalized : null;
}

export function IdCardPassportPhoto({ imageUrl, alt, fallbackText, imageClassName, fallbackClassName }: IdCardPassportPhotoProps) {
  const resolvedImageUrl = useMemo(() => normalizeImageUrl(imageUrl), [imageUrl]);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [resolvedImageUrl]);

  if (resolvedImageUrl && !hasImageError) {
    return (
      <img
        src={resolvedImageUrl}
        alt={alt}
        className={imageClassName}
        loading="eager"
        decoding="sync"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return <div className={fallbackClassName}>{fallbackText}</div>;
}
