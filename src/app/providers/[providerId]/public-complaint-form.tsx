"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PublicComplaintForm({
  providerSlug,
  providerProfileId,
  providerMsmeId,
}: {
  providerSlug: string;
  providerProfileId: string;
  providerMsmeId: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setClientError(null);
        setIsSubmitting(true);

        try {
          const form = event.currentTarget;
          const formData = new FormData(form);
          const response = await fetch("/api/public-complaints", {
            method: "POST",
            body: formData,
          });

          const redirectedTo = response.url;
          if (!redirectedTo) {
            throw new Error("submit_failed");
          }

          const redirectUrl = new URL(redirectedTo);
          router.push(`${redirectUrl.pathname}${redirectUrl.search}`);
          router.refresh();
        } catch (error) {
          console.error("[public-complaint][submit_failed]", error);
          setClientError("We could not submit your complaint right now. Please retry.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <input type="hidden" name="provider_path_segment" value={providerSlug} />
      <input type="hidden" name="provider_profile_id" value={providerProfileId} />
      <input type="hidden" name="provider_msme_public_id" value={providerMsmeId} />
      <input type="hidden" name="provider_slug" value={providerSlug} />
      <input name="full_name" placeholder="Full name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
      <input name="email" type="email" placeholder="Email address" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
      <input name="phone" placeholder="Phone number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
      <select name="preferred_contact_method" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <option value="email">Email</option>
        <option value="phone">Phone</option>
        <option value="sms">SMS</option>
      </select>
      <select name="complaint_type" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <option value="general_marketplace_report">General marketplace report</option>
        <option value="fraud">Fraud</option>
        <option value="delivery_dispute">Delivery dispute</option>
        <option value="pricing_abuse">Pricing abuse</option>
        <option value="counterfeit_products">Counterfeit products</option>
        <option value="service_quality">Service quality</option>
      </select>
      <select name="severity" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <input name="short_summary" placeholder="Short summary" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
      <textarea name="description" placeholder="Describe the issue" className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
      <label className="block text-xs font-medium text-slate-600">
        Evidence attachment (optional)
        <input
          name="evidence_attachment"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium"
        />
      </label>
      <input name="related_reference" placeholder="Quote, invoice, or order reference (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <input type="checkbox" name="consent_confirmation" value="yes" className="mt-0.5" required />
        <span>I confirm that the information provided is accurate and may be used for complaint investigation and case management.</span>
      </label>
      {clientError && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{clientError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Submitting complaint..." : "Submit complaint"}
      </button>
    </form>
  );
}
