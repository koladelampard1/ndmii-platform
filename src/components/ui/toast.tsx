"use client";

import { useEffect } from "react";

type ToastProps = {
  open: boolean;
  message: string;
  onClose: () => void;
  durationMs?: number;
};

export function Toast({ open, message, onClose, durationMs = 2200 }: ToastProps) {
  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      onClose();
    }, durationMs);

    return () => window.clearTimeout(timeout);
  }, [durationMs, onClose, open]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      {message}
    </div>
  );
}
