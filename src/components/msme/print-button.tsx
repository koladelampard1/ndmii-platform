"use client";

import { useCallback, type ReactNode } from "react";

type PrintButtonProps = {
  targetId?: string;
  className?: string;
  label?: string;
  helper?: string;
  icon?: ReactNode;
};

const PRINT_STYLE_ID = "msme-id-card-print-style";
const PRINT_BODY_CLASS = "msme-id-card-printing";

function ensurePrintStyles(targetId: string) {
  const css = `
    @page {
      margin: 14mm;
      size: A4 portrait;
    }

    @media print {
      html, body {
        background: #ffffff !important;
      }

      body.${PRINT_BODY_CLASS} * {
        visibility: hidden !important;
      }

      body.${PRINT_BODY_CLASS} #${targetId},
      body.${PRINT_BODY_CLASS} #${targetId} * {
        visibility: visible !important;
      }

      body.${PRINT_BODY_CLASS} #${targetId} {
        position: fixed;
        top: 14mm;
        left: 50%;
        transform: translateX(-50%);
        width: min(180mm, 100%);
        height: auto !important;
        aspect-ratio: 1.586;
        box-shadow: none !important;
        border-radius: 0 !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;

  const existing = document.getElementById(PRINT_STYLE_ID);
  if (existing) {
    existing.textContent = css;
    return;
  }

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

export function PrintButton({
  targetId = "msme-id-card-canvas",
  className,
  label = "Download / Print",
  helper,
  icon,
}: PrintButtonProps) {
  const handlePrintCard = useCallback(() => {
    const card = document.getElementById(targetId);
    if (!card) return;

    ensurePrintStyles(targetId);

    const cleanup = () => {
      document.body.classList.remove(PRINT_BODY_CLASS);
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    document.body.classList.add(PRINT_BODY_CLASS);

    requestAnimationFrame(() => {
      window.print();
    });
  }, [targetId]);

  return (
    <button
      onClick={handlePrintCard}
      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-900 transition hover:border-slate-300 ${className ?? ""}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100">{icon ?? "🖨️"}</span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {helper ? <span className="block text-xs text-slate-500">{helper}</span> : null}
      </span>
    </button>
  );
}
