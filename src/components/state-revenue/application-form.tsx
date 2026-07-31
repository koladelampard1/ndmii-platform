import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, LockKeyhole, MapPinned } from "lucide-react";
import { EKITI_CONSTITUTIONAL_LGAS } from "@/lib/state-revenue/jurisdictions";
import type { OwnedStateRevenueBusiness, StateRevenueApplicationDetail } from "@/lib/state-revenue/onboarding";
import { StateRevenueProgressTracker } from "@/components/state-revenue/state-revenue-components";

const SECTORS = ["Retail", "Services", "Agro-processing", "Manufacturing", "Creative", "Technology", "Transport", "Food services"];
const EVIDENCE_TYPES = [
  ["operating_location_photograph", "Operating-location photograph"],
  ["utility_bill", "Utility bill"],
  ["tenancy_or_occupancy", "Tenancy or occupancy evidence"],
  ["market_association_confirmation", "Market association confirmation"],
  ["trade_association_confirmation", "Trade association confirmation"],
  ["local_government_permit", "Local government permit"],
  ["shop_or_business_permit", "Shop or business permit"],
  ["cac_document", "CAC document"],
  ["tin_reference", "TIN/taxpayer reference"],
  ["agriculture_farm_location_evidence", "Agriculture or farm-location evidence"],
  ["other", "Other approved evidence"],
] as const;

function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      <span>{label}{required ? <span className="text-rose-600" aria-label="required"> *</span> : null}</span>
      {children}
    </label>
  );
}

const inputClass = "h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const textareaClass = "min-h-32 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const sectionClass = "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-7";

export function StateRevenueApplicationForm({
  action,
  mode,
  error,
  application,
  ownedBusinesses = [],
  applicantResponse = false,
}: {
  action: (formData: FormData) => Promise<void>;
  mode: "new_business" | "existing_business";
  error?: string | null;
  application?: StateRevenueApplicationDetail | null;
  ownedBusinesses?: OwnedStateRevenueBusiness[];
  applicantResponse?: boolean;
}) {
  const location = application?.location;
  const selectedEvidence = new Set(application?.evidence.map((item) => item.evidence_type) ?? []);
  return (
    <form action={action} className="mx-auto max-w-5xl space-y-7 px-5 py-10 lg:px-8">
      {application ? (
        <>
          <input type="hidden" name="application_id" value={application.id} />
          <input type="hidden" name="application_reference" value={application.application_reference} />
        </>
      ) : null}
      <StateRevenueProgressTracker
        steps={[
          { label: "Business pathway", description: mode === "existing_business" ? "Preserve an existing DBIN identity." : "Start a new identity pathway.", status: "complete" },
          { label: "Business information", description: "Core records and contact details.", status: "current" },
          { label: "Ekiti location", description: "Operating presence and activity.", status: "next" },
          { label: "Evidence & declaration", description: "Consent and final submission.", status: "next" },
        ]}
      />
      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{decodeURIComponent(error)}</div> : null}
      {application ? (
        <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
          <p className="font-black">Application {application.application_reference}</p>
          <p className="mt-1">Current status: <span className="font-black">{application.current_status.replace(/_/g, " ")}</span></p>
        </div>
      ) : null}
      <section className={sectionClass}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"><FileText className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Business records</p>
            <h2 className="mt-2 text-2xl font-black">Business and applicant information</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Use the name and contact details EKIRS should rely on during review. Optional CAC/TIN fields help readiness but are not silently treated as tax approval.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {mode === "existing_business" ? (
            <Field label="Select your DBIN business" required>
              {ownedBusinesses.length ? (
                <div className="grid gap-3">
                  <select name="existing_business_id" className={inputClass} defaultValue={application?.existing_business_id ?? ""} required>
                    <option value="">Choose a business</option>
                    {ownedBusinesses.map((business) => {
                      const relationship = business.state_revenue_jurisdiction_relationships?.[0];
                      return (
                        <option key={business.id} value={business.id}>
                          {business.business_name ?? "Unnamed business"} · {business.msme_id ?? "BIN pending"} · {business.lga ?? business.state ?? "location pending"}{relationship ? ` · EKIRS ${relationship.relationship_status}` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-950">
                    <p className="font-black">Your existing BIN will be preserved.</p>
                    <p className="mt-1">Only businesses owned by this signed-in account are available here.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <p className="font-black">No owned DBIN business found</p>
                  <p className="mt-1">Only businesses linked to your account can be selected. Start a new-business application if this business is not yet on DBIN.</p>
                  <Link href="/ekirs/apply/new" className="mt-3 inline-flex text-sm font-black text-emerald-800">Start new-business application</Link>
                </div>
              )}
            </Field>
          ) : null}
          <Field label="Business name" required>
            <input name="business_name" className={inputClass} defaultValue={application?.proposed_business_name ?? ""} required />
          </Field>
          <Field label="Owner or authorised representative">
            <input name="owner_name" className={inputClass} defaultValue={application?.owner_name ?? ""} />
          </Field>
          <Field label="Contact email" required>
            <input name="contact_email" type="email" className={inputClass} defaultValue={application?.contact_email ?? ""} required />
          </Field>
          <Field label="Contact phone">
            <input name="contact_phone" className={inputClass} inputMode="tel" defaultValue={application?.contact_phone ?? ""} />
          </Field>
          <Field label="Sector" required>
            <select name="sector" className={inputClass} defaultValue={application?.sector ?? ""} required>
              <option value="">Select sector</option>
              {SECTORS.map((sector) => <option key={sector}>{sector}</option>)}
            </select>
          </Field>
          <Field label="Formalisation status" required>
            <select name="formality_status" className={inputClass} defaultValue={application?.formality_status ?? "informal"} required>
              <option value="informal">Informal business</option>
              <option value="transitioning">Transitioning to formal</option>
              <option value="formal">Formal business</option>
            </select>
          </Field>
          <Field label="CAC number, optional">
            <input name="cac_number" className={inputClass} defaultValue={application?.cac_number ?? ""} />
          </Field>
          <Field label="TIN, optional">
            <input name="tin" className={inputClass} defaultValue={application?.tin ?? ""} />
          </Field>
        </div>
      </section>
      <section className={sectionClass}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-800 ring-1 ring-sky-200"><MapPinned className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Operating presence</p>
            <h2 className="mt-2 text-2xl font-black">Ekiti operating location</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Eligibility is based on genuine Ekiti operation, not owner indigeneity, phone number or uploaded evidence alone.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Constitutional LGA" required>
            <select name="lga_name" className={inputClass} defaultValue={location?.lga_name ?? ""} required>
              <option value="">Select LGA</option>
              {EKITI_CONSTITUTIONAL_LGAS.map((lga) => <option key={lga}>{lga}</option>)}
            </select>
          </Field>
          <Field label="Town or community" required>
            <input name="town" className={inputClass} defaultValue={location?.town ?? ""} required />
          </Field>
          <Field label="Community, optional">
            <input name="community" className={inputClass} defaultValue={location?.community ?? ""} />
          </Field>
          <Field label="Location type" required>
            <select name="location_type" className={inputClass} defaultValue={location?.location_type ?? "shop"} required>
              <option value="shop">Shop</option>
              <option value="market_stall">Market stall</option>
              <option value="branch">Branch</option>
              <option value="office">Office</option>
              <option value="farm">Farm</option>
              <option value="production_site">Production site</option>
              <option value="warehouse">Warehouse</option>
              <option value="mobile_service_area">Mobile/service area</option>
              <option value="other">Other approved location</option>
            </select>
          </Field>
          <Field label="Operation commenced, optional">
            <input name="operation_commenced_on" type="date" className={inputClass} defaultValue={location?.operation_commenced_on ?? ""} />
          </Field>
          <Field label="Landmark">
            <input name="landmark" className={inputClass} defaultValue={location?.landmark ?? ""} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Operating address" required>
              <textarea name="address" className={textareaClass} defaultValue={location?.address ?? ""} required />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Business activity at this location" required>
              <textarea name="business_activity" className={textareaClass} defaultValue={location?.business_activity ?? ""} required />
            </Field>
          </div>
        </div>
      </section>
      <section className={sectionClass}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200"><LockKeyhole className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Private evidence</p>
            <h2 className="mt-2 text-2xl font-black">Evidence, consent and declaration</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Select the types of evidence you can provide. Actual file upload remains private and review-controlled.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {EVIDENCE_TYPES.map(([value, label]) => (
            <label key={value} className="flex min-h-14 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50/40">
              <input type="checkbox" name="evidence_types" value={value} className="mt-1" defaultChecked={selectedEvidence.has(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <input type="checkbox" name="location_consent" className="mt-1" defaultChecked={application?.location_consent_status === "granted"} />
            <span>I consent to location verification where it is lawful, safe and necessary. GPS is not silently collected.</span>
          </label>
          <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <input type="checkbox" name="declaration_accepted" className="mt-1" defaultChecked={application?.declaration_accepted ?? false} required />
            <span>I confirm the information is accurate and understand DBIN identity is not a CAC certificate, TIN or tax-clearance certificate.</span>
          </label>
        </div>
      </section>
      {applicantResponse ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Additional information requested</p>
          <h2 className="mt-2 text-2xl font-black">Response to reviewer</h2>
          {application?.additional_information_request?.notes ? <p className="mt-2 text-sm leading-6 text-amber-950">{String(application.additional_information_request.notes)}</p> : null}
          <Field label="Your response">
            <textarea name="applicant_response" className={textareaClass} placeholder="Explain what you updated or which evidence you replaced." />
          </Field>
        </section>
      ) : null}
      <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-[1.75rem] border border-slate-200 bg-white/95 p-3 shadow-2xl shadow-slate-300/50 backdrop-blur">
        <button type="submit" name="intent" value="submit" className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-800"><CheckCircle2 className="h-4 w-4" />{application?.current_status === "additional_information_required" || application?.current_status === "evidence_required" ? "Resubmit application" : "Submit application"}</button>
        <button type="submit" name="intent" value="draft" formNoValidate className="rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-50">Save draft</button>
        <Link href="/ekirs/apply" className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">Back</Link>
      </div>
    </form>
  );
}
