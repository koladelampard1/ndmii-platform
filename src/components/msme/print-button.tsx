"use client";

import { useCallback } from "react";

type PrintButtonProps = {
  targetId?: string;
};

const PRINT_STYLE_ID = "msme-id-card-print-style";
const PRINT_BODY_CLASS = "msme-id-card-printing";

function ensurePrintStyles(targetId: string) {
  const existing = document.getElementById(PRINT_STYLE_ID);
  if (existing) {
    existing.textContent = `
      @page {
        margin: 12mm;
        size: auto;
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
          inset: 0;
          margin: 0 auto;
          width: min(100%, 1080px);
          height: fit-content;
          box-shadow: none !important;
          border-radius: 0 !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `;
    return;
  }

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @page {
      margin: 12mm;
      size: auto;
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
        inset: 0;
        margin: 0 auto;
        width: min(100%, 1080px);
        height: fit-content;
        box-shadow: none !important;
        border-radius: 0 !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;

  document.head.appendChild(style);
}

export function PrintButton({ targetId = "msme-id-card-canvas" }: PrintButtonProps) {
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
      className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      Download / Print
    </button>
  );
}
