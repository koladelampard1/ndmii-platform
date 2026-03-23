"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const steps = [
  "Business Information",
  "Owner / Contact Information",
  "Location and Sector Information",
  "Association Linkage",
  "KYC / Verification Inputs",
  "Review and Submit",
];

type Props = {
  associations: { id: string; name: string }[];
  onSave: (formData: FormData) => void | Promise<void>;
};

export function OnboardingWizard({ associations, onSave }: Props) {
  const [step, setStep] = useState(0);
  const [passportPreview, setPassportPreview] = useState("");
  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  const onPassportChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setPassportPreview(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  return (
    <form action={onSave} className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <input type="hidden" name="currentStep" value={steps[step]} />
      <input type="hidden" name="passport_photo_data" value={passportPreview} />

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">MSME onboarding wizard</p>
        <h2 className="text-2xl font-bold text-slate-900">{steps[step]}</h2>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Step {step + 1} of {steps.length} • {progress}% completed</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {step === 0 && (
          <>
            <input name="business_name" required className="rounded border px-3 py-2" placeholder="Business Name" />
            <input name="business_type" className="rounded border px-3 py-2" placeholder="Business Type" />
            <input name="rc_number" className="rounded border px-3 py-2" placeholder="Registration Number" />
            <input name="year_started" className="rounded border px-3 py-2" placeholder="Year Started" />
          </>
        )}
        {step === 1 && (
          <>
            <input name="owner_name" required className="rounded border px-3 py-2" placeholder="Owner Full Name" />
            <input name="contact_phone" className="rounded border px-3 py-2" placeholder="Phone Number" />
            <input name="contact_email" type="email" className="rounded border px-3 py-2" placeholder="Email" />
            <input name="contact_title" className="rounded border px-3 py-2" placeholder="Designation" />
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Passport Photograph</label>
              <input type="file" accept="image/*" className="rounded border px-3 py-2 text-sm" onChange={onPassportChange} />
              <p className="text-xs text-slate-500">Optional. A small passport-style photo improves regulator verification and ID card quality.</p>
              {passportPreview && <img src={passportPreview} alt="Passport preview" className="h-20 w-20 rounded-lg border object-cover" />}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <input name="state" required className="rounded border px-3 py-2" placeholder="State" />
            <input name="lga" className="rounded border px-3 py-2" placeholder="LGA" />
            <input name="sector" required className="rounded border px-3 py-2" placeholder="Sector" />
            <input name="address" className="rounded border px-3 py-2" placeholder="Registered Address" />
          </>
        )}
        {step === 3 && (
          <>
            <select name="association_id" className="rounded border px-3 py-2 md:col-span-2">
              <option value="">Select Association</option>
              {associations.map((association) => (
                <option key={association.id} value={association.id}>{association.name}</option>
              ))}
            </select>
          </>
        )}
        {step === 4 && (
          <>
            <input name="nin" className="rounded border px-3 py-2" placeholder="NIN" />
            <input name="bvn" className="rounded border px-3 py-2" placeholder="BVN" />
            <input name="cac_number" className="rounded border px-3 py-2" placeholder="CAC Number" />
            <input name="tin" className="rounded border px-3 py-2" placeholder="TIN" />
          </>
        )}
        {step === 5 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 md:col-span-2">
            Review your information and choose <strong>Save Draft</strong> or <strong>Submit Final</strong>.
            Automated CAC, NIN, BVN, and TIN validation runs immediately at save time.
          </div>
        )}
      </section>

      <div className="flex flex-wrap justify-between gap-3">
        <div className="space-x-2">
          <Button type="button" variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Previous
          </Button>
          <Button type="button" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
            Next
          </Button>
        </div>
        <div className="space-x-2">
          <Button name="intent" value="draft" variant="secondary">Save Draft</Button>
          <Button name="intent" value="submit">Submit Final</Button>
        </div>
      </div>
    </form>
  );
}
