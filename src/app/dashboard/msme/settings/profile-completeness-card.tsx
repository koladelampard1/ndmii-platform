"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";

export type ProfileCompletenessSignals = {
  businessNamePresent: boolean;
  categoryPresent: boolean;
  subCategoryPresent: boolean;
  cacPresent: boolean;
  ownerNamePresent: boolean;
  contactInfoPresent: boolean;
  addressPresent: boolean;
  descriptionPresent: boolean;
  logoUploaded: boolean;
  providerProfileExists: boolean;
};

type CompletenessItem = {
  label: string;
  complete: boolean;
};

function buildCompletenessItems(signals: ProfileCompletenessSignals): CompletenessItem[] {
  return [
    { label: "Business name", complete: signals.businessNamePresent },
    { label: "Business category", complete: signals.categoryPresent },
    { label: "Business sub-category", complete: signals.subCategoryPresent },
    { label: "CAC registration", complete: signals.cacPresent },
    { label: "Owner name", complete: signals.ownerNamePresent },
    { label: "Contact info", complete: signals.contactInfoPresent },
    { label: "Address", complete: signals.addressPresent },
    { label: "Business description", complete: signals.descriptionPresent },
    { label: "Logo uploaded", complete: signals.logoUploaded },
    { label: "Provider profile", complete: signals.providerProfileExists },
  ];
}

export function ProfileCompletenessCard({ initialSignals }: { initialSignals: ProfileCompletenessSignals }) {
  const [signals, setSignals] = useState<ProfileCompletenessSignals>(initialSignals);

  useEffect(() => {
    setSignals(initialSignals);
  }, [initialSignals]);

  useEffect(() => {
    const onLogoUploaded = (event: Event) => {
      const customEvent = event as CustomEvent<{ logoUrl?: string }>;
      const logoUrl = String(customEvent.detail?.logoUrl ?? "").trim();
      setSignals((prev) => ({ ...prev, logoUploaded: Boolean(logoUrl) || prev.logoUploaded }));
    };

    window.addEventListener("ndmii:logo-uploaded", onLogoUploaded);
    return () => window.removeEventListener("ndmii:logo-uploaded", onLogoUploaded);
  }, []);

  const completeness = useMemo(() => {
    const items = buildCompletenessItems(signals);
    const completeCount = items.filter((item) => item.complete).length;
    const percentage = Math.round((completeCount / items.length) * 100);
    return { items, completeCount, percentage };
  }, [signals]);

  useEffect(() => {
    console.info("[profile-completion] recomputed");
  }, [completeness.percentage, completeness.completeCount]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Profile Completeness</h3>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-emerald-600 text-lg font-semibold text-slate-900">
          {completeness.percentage}%
        </div>
        <p className="text-sm text-slate-600">Completion is calculated from saved profile fields only.</p>
      </div>
      <ul className="mt-4 space-y-2">
        {completeness.items.map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-sm">
            {item.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-4 w-4 text-amber-500" />}
            <span className={item.complete ? "text-slate-700" : "text-slate-500"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
