"use client";

import { useEffect, useState } from "react";
import { MonitorPlay } from "lucide-react";

export function NrsPresentationModeToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.nrsPresentation = enabled ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.nrsPresentation;
    };
  }, [enabled]);

  return (
    <>
      <button
        type="button"
        onClick={() => setEnabled((value) => !value)}
        className="presentation-hide inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-white/25"
        aria-pressed={enabled}
      >
        <MonitorPlay className="h-4 w-4" />
        {enabled ? "Exit Presentation Mode" : "Presentation Mode"}
      </button>
      <style jsx global>{`
        html[data-nrs-presentation="true"] .presentation-hide {
          display: none !important;
        }

        html[data-nrs-presentation="true"] .nrs-executive-shell {
          max-width: 1440px;
          margin-left: auto;
          margin-right: auto;
        }

        html[data-nrs-presentation="true"] .presentation-expand {
          padding: 1.5rem;
          box-shadow: 0 18px 60px rgba(15, 23, 42, 0.1);
        }

        html[data-nrs-presentation="true"] .presentation-kpi-grid {
          gap: 1rem;
        }
      `}</style>
    </>
  );
}
