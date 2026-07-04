import Link from "next/link";
import { AlertCircle, CheckCircle2, FileText, Home, MapPin, ShieldCheck, UploadCloud, Users } from "lucide-react";
import { Field, inputClass, PropertyProgress, PropertyWorkspaceHero, textareaClass } from "@/components/property/property-workspace";
import { PropertyDraftGuard } from "@/components/property/property-draft-guard";
import { savePropertyRegistrationAction } from "@/app/dashboard/property/actions";
import { getEditableProperty, getPropertyLookups, requirePropertyWorkspaceAccess } from "@/app/dashboard/property/_queries";

export const dynamic = "force-dynamic";

const propertyTypes = [
  ["residential", "Residential"],
  ["commercial", "Commercial"],
  ["industrial", "Industrial"],
  ["agricultural", "Agricultural"],
  ["mining", "Mining"],
  ["institutional", "Institutional"],
  ["government", "Government"],
  ["mixed_use", "Mixed Use"],
] as const;

const ownerTypes = [
  ["individual", "Individual"],
  ["corporate", "Corporate"],
  ["government", "Government"],
  ["community", "Community"],
  ["trust", "Trust"],
  ["cooperative", "Cooperative"],
  ["institution", "Institution"],
] as const;

const documentTypes = [
  ["survey_plan", "Survey Plan"],
  ["certificate_of_occupancy", "Certificate of Occupancy"],
  ["deed_of_assignment", "Deed of Assignment"],
  ["allocation_letter", "Allocation Letter"],
  ["photographs", "Photographs"],
  ["supporting_evidence", "Supporting Documents"],
  ["building_approval", "Building Approval"],
] as const;

function clampStep(value?: string) {
  const parsed = Number(value ?? 1);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : 1;
}

export default async function PropertyRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; step?: string; success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { ctx, supabase } = await requirePropertyWorkspaceAccess();
  const [lookups, property] = await Promise.all([
    getPropertyLookups(supabase),
    getEditableProperty(supabase, query.property ?? null, ctx.appUserId!),
  ]);
  const step = clampStep(query.step);
  const address = property?.addresses[0] ?? null;
  const owners = property?.owners ?? [];
  const nigeriaId = lookups.countries.find((country) => country.iso2 === "NG")?.id ?? lookups.countries[0]?.id ?? "";
  const validation = [
    { label: "Property type", ok: Boolean(property?.property_type) },
    { label: "Location", ok: Boolean(property?.state_id && property?.lga_id) },
    { label: "Owner", ok: owners.length > 0 },
    { label: "Documents", ok: (property?.documents.length ?? 0) > 0 },
  ];

  return (
    <main className="space-y-6">
      <PropertyWorkspaceHero
        eyebrow="Digital property registration"
        title={property ? "Resume Property Registration" : "Register a Property"}
        description="Complete the registration wizard, save a draft at any point, and submit when the application is ready for registry review."
        actions={[
          { href: "/dashboard/property/drafts", label: "Drafts" },
          { href: "/dashboard/property/my-properties", label: "My Properties" },
        ]}
      />

      {query.success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Draft saved successfully.</p> : null}
      {query.error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{decodeURIComponent(query.error)}</p> : null}

      <PropertyProgress currentStep={step} />

      <form id="property-registration-form" action={savePropertyRegistrationAction} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7" encType="multipart/form-data">
        <PropertyDraftGuard formId="property-registration-form" />
        <input type="hidden" name="property_id" value={property?.id ?? ""} />
        <input type="hidden" name="current_step" value={step} />
        <input type="hidden" name="country_id" value={property?.country_id ?? address?.country_id ?? nigeriaId} />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Step {step} of 6</p>
            <h2 className="mt-1 text-2xl font-black text-[#06172f]">{stepTitle(step)}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }, (_, index) => {
              const href = `/dashboard/property/register${property?.id ? `?property=${property.id}&step=${index + 1}` : `?step=${index + 1}`}`;
              return <Link key={href} href={href} className={`rounded-full px-3 py-1 text-xs font-black ${step === index + 1 ? "bg-[#06172f] text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}</Link>;
            })}
          </div>
        </div>

        <div className={step === 1 ? "block" : "hidden"}>
          <SectionIntro icon={Home} title="Property Type" detail="Classify the property using the national registry categories." />
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {propertyTypes.map(([value, label]) => (
              <label key={value} className="rounded-2xl border border-slate-200 p-4 transition has-[:checked]:border-[#008751] has-[:checked]:bg-emerald-50">
                <input type="radio" name="property_type" value={value} defaultChecked={(property?.property_type ?? "residential") === value} className="mr-2" />
                <span className="font-black text-[#06172f]">{label}</span>
              </label>
            ))}
          </div>
          <div className="mt-5">
            <Select name="property_category_id" label="Registry category" defaultValue={property?.property_category_id ?? ""} options={lookups.categories.map((category) => [category.id, category.name])} />
          </div>
        </div>

        <div className={step === 2 ? "block" : "hidden"}>
          <SectionIntro icon={FileText} title="Property Details" detail="Capture the business-readable description of the property." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Property name"><input className={inputClass} name="title" defaultValue={property?.title ?? ""} placeholder="e.g. Ibeju Industrial Plot 14" /></Field>
            <Field label="Approximate size"><input className={inputClass} name="area_size" type="number" min="0" step="0.0001" defaultValue={property?.area_size ?? ""} /></Field>
            <Field label="Measurement unit"><input className={inputClass} name="area_unit" defaultValue={property?.area_unit ?? ""} placeholder="sqm, hectares, acres" /></Field>
            <Field label="Development stage"><input className={inputClass} name="development_stage" defaultValue={String(property?.metadata?.development_stage ?? "")} placeholder="undeveloped, under construction, occupied" /></Field>
            <Field label="Current use"><input className={inputClass} name="current_use" defaultValue={String(property?.metadata?.current_use ?? "")} /></Field>
            <Field label="Planned use"><input className={inputClass} name="planned_use" defaultValue={String(property?.metadata?.planned_use ?? "")} /></Field>
          </div>
          <div className="mt-4"><Field label="Description"><textarea className={textareaClass} name="description" defaultValue={property?.description ?? ""} /></Field></div>
        </div>

        <div className={step === 3 ? "block" : "hidden"}>
          <SectionIntro icon={MapPin} title="Location" detail="Enter the basic location and optional approximate coordinates. No map or boundary drawing is used in this phase." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Select name="state_id" label="State" defaultValue={property?.state_id ?? address?.state_id ?? ""} options={lookups.states.map((state) => [state.id, state.name])} />
            <Select name="lga_id" label="LGA" defaultValue={property?.lga_id ?? address?.lga_id ?? ""} options={lookups.lgas.map((lga) => [lga.id, lga.name])} />
            <Select name="ward_id" label="Ward" defaultValue={property?.ward_id ?? address?.ward_id ?? ""} options={lookups.wards.map((ward) => [ward.id, ward.name])} optional />
            <Select name="community_id" label="Community" defaultValue={property?.community_id ?? address?.community_id ?? ""} options={lookups.communities.map((community) => [community.id, community.name])} optional />
            <Select name="village_id" label="Village" defaultValue={property?.village_id ?? address?.village_id ?? ""} options={lookups.villages.map((village) => [village.id, village.name])} optional />
            <Field label="Street"><input className={inputClass} name="street" defaultValue={address?.street ?? ""} /></Field>
            <Field label="Plot"><input className={inputClass} name="plot" defaultValue={address?.plot ?? ""} /></Field>
            <Field label="Block"><input className={inputClass} name="block" defaultValue={address?.block ?? ""} /></Field>
            <Field label="Parcel reference"><input className={inputClass} name="parcel_reference" defaultValue={property?.parcel_reference ?? address?.parcel_reference ?? ""} /></Field>
            <Field label="Latitude"><input className={inputClass} name="centroid_latitude" type="number" step="0.0000001" defaultValue={address?.centroid_latitude ?? ""} /></Field>
            <Field label="Longitude"><input className={inputClass} name="centroid_longitude" type="number" step="0.0000001" defaultValue={address?.centroid_longitude ?? ""} /></Field>
          </div>
          <div className="mt-4"><Field label="Traditional description"><textarea className={textareaClass} name="traditional_description" defaultValue={address?.traditional_description ?? ""} /></Field></div>
        </div>

        <div className={step === 4 ? "block" : "hidden"}>
          <SectionIntro icon={Users} title="Ownership" detail="Add one or more ownership claimants. These remain unverified until a later review phase." />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 4 }, (_, index) => {
              const owner = owners[index];
              return (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <input type="hidden" name={`owner_${index}_id`} value={owner?.id ?? ""} />
                  <p className="font-black text-[#06172f]">Owner {index + 1}</p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <Select name={`owner_${index}_type`} label="Owner type" defaultValue={owner?.owner_type ?? (index === 0 ? "individual" : "")} options={ownerTypes as unknown as Array<[string, string]>} optional={index > 0} />
                    <Field label="Owner name"><input className={inputClass} name={`owner_${index}_name`} defaultValue={owner?.owner_name ?? ""} /></Field>
                    <Field label="Ownership percentage"><input className={inputClass} name={`owner_${index}_percentage`} type="number" min="0" max="100" step="0.001" defaultValue={owner?.ownership_percentage ?? ""} /></Field>
                    <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#06172f]">
                      <input type="checkbox" name={`owner_${index}_primary`} defaultChecked={owner?.is_primary ?? index === 0} />
                      Primary owner
                    </label>
                  </div>
                  <div className="mt-3"><Field label="Ownership notes"><input className={inputClass} name={`owner_${index}_notes`} defaultValue={String(owner?.metadata?.notes ?? "")} /></Field></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={step === 5 ? "block" : "hidden"}>
          <SectionIntro icon={UploadCloud} title="Documents" detail="Upload supporting evidence. Files are stored privately and recorded as property document metadata." />
          {property?.documents.length ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
              {property.documents.length} document record{property.documents.length === 1 ? "" : "s"} already attached.
            </div>
          ) : null}
          <div className="mt-5 space-y-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-[#06172f]">Document {index + 1}</p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <Select name={`document_${index}_type`} label="Document type" defaultValue={index === 0 ? "survey_plan" : ""} options={documentTypes as unknown as Array<[string, string]>} optional={index > 0} />
                  <Field label="Title"><input className={inputClass} name={`document_${index}_title`} /></Field>
                  <Field label="File"><input className={inputClass} name={`document_${index}_file`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" /></Field>
                  <Field label="Description"><input className={inputClass} name={`document_${index}_description`} /></Field>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={step === 6 ? "block" : "hidden"}>
          <SectionIntro icon={ShieldCheck} title="Review" detail="Review readiness before saving or submitting. Server-side validation will run when you submit." />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {validation.map((item) => (
              <div key={item.label} className={`flex items-center gap-3 rounded-2xl border p-4 ${item.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                {item.ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                <span className="font-black">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            <p><strong className="text-[#06172f]">Application reference:</strong> {property?.application_reference ?? "Generated on first submission"}</p>
            <p className="mt-2"><strong className="text-[#06172f]">NPIN:</strong> {property?.npin ?? "Pending registry approval"}</p>
            <p className="mt-2">Submitting sends this application into the registry pipeline. Official NPIN issuance, approval, verification, GIS review and public verification are not part of Phase 2.</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {step > 1 ? <Link href={`/dashboard/property/register${property?.id ? `?property=${property.id}&step=${step - 1}` : `?step=${step - 1}`}`} className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-black text-[#06172f]">Previous</Link> : null}
            {step < 6 ? <button name="next_step" value={step + 1} className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-black text-[#06172f]" type="submit">Save & Continue</button> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button name="intent" value="draft" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black text-[#06172f]" type="submit">Save Draft</button>
            <button name="intent" value="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-[#06172f] px-5 text-sm font-black text-white" type="submit">Submit for Review</button>
          </div>
        </div>
      </form>
    </main>
  );
}

function SectionIntro({ icon: Icon, title, detail }: { icon: typeof Home; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-[#008751]"><Icon className="h-5 w-5" /></span>
      <div>
        <h3 className="text-xl font-black text-[#06172f]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

function Select({ name, label, defaultValue, options, optional = false }: { name: string; label: string; defaultValue: string; options: Array<[string, string]>; optional?: boolean }) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={defaultValue} className={inputClass}>
        {optional ? <option value="">Not specified</option> : <option value="">Select {label.toLowerCase()}</option>}
        {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </Field>
  );
}

function stepTitle(step: number) {
  return ["Property Type", "Property Details", "Location", "Ownership", "Documents", "Review"][step - 1] ?? "Property Registration";
}
