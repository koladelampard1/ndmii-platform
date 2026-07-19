import Link from "next/link";
import { AlertCircle, CheckCircle2, FileText, MapPin, ShieldCheck, UserCheck, Users } from "lucide-react";
import {
  addCaseCommentAction,
  assignRegistryCaseAction,
  generateCertificateAction,
  issueNpinCredentialAction,
  reviewGeometryAction,
  reviewDocumentAction,
  reviewOwnerAction,
  updateCaseDecisionAction,
} from "@/app/dashboard/property/operations/actions";
import { getRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import { getRegistryCaseDetail, listAssignablePropertyUsers, resolvePropertyCaseAccess } from "@/lib/property/property-operations-service";
import { boxFromRecord, findPotentialGeometryOverlaps, getActivePropertyGeometry, getPropertyGeometryHistory } from "@/lib/property/property-gis-service";
import { CaseSummaryCards, CertificatePreview, RegistryOperationsHero, Timeline } from "@/components/property/property-operations-workspace";
import { GeometryHistory, GeometryPreview } from "@/components/property/property-gis-tools";
import { PropertyStatusBadge, inputClass, textareaClass } from "@/components/property/property-workspace";

export const dynamic = "force-dynamic";

const decisionOptions = [
  ["under_review", "Start Review"],
  ["awaiting_documents", "Request Documents"],
  ["awaiting_survey", "Awaiting Survey"],
  ["awaiting_ownership", "Awaiting Ownership"],
  ["approved", "Approve"],
  ["rejected", "Reject"],
  ["returned", "Return for Correction"],
  ["suspended", "Suspend"],
  ["cancelled", "Cancel"],
  ["verified", "Mark Verified"],
] as const;

const assignmentRoles = [
  ["registry_manager", "Registry Manager"],
  ["land_registry_officer", "Land Registry Officer"],
  ["survey_officer", "Survey Officer"],
  ["document_verifier", "Document Verifier"],
  ["property_reviewer", "Property Reviewer"],
  ["title_issuer", "Title Issuer"],
] as const;

export default async function RegistryReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { ctx, supabase } = await getRegistryOperationsContext();
  const [detail, caseAccess] = await Promise.all([
    getRegistryCaseDetail({ caseId: id, client: supabase, ctx }),
    resolvePropertyCaseAccess({ caseId: id, client: supabase, ctx }),
  ]);
  const [geometry, geometryEvents] = await Promise.all([
    getActivePropertyGeometry({ propertyId: detail.property.id, client: supabase }).catch(() => null),
    getPropertyGeometryHistory({ propertyId: detail.property.id, client: supabase }).catch(() => []),
  ]);
  const overlaps = geometry ? await findPotentialGeometryOverlaps({ propertyId: detail.property.id, boundingBox: boxFromRecord(geometry.bounding_box), client: supabase }).catch(() => []) : [];
  const users = caseAccess.canOverrideCase ? await listAssignablePropertyUsers({ client: supabase }) : [];
  const address = detail.addresses[0] ?? null;
  const canMutate = caseAccess.canOperateCase;
  const canOverride = caseAccess.canOverrideCase;

  return (
    <main className="space-y-6">
      <RegistryOperationsHero
        eyebrow="Registry case review"
        title={`${detail.case_reference} · ${detail.property.title || detail.property.property_type.replaceAll("_", " ")}`}
        description="Review property summary, ownership, documents, assignments, comments, timeline and registry decision actions on a single case screen."
        actions={[
          { href: "/dashboard/property/operations", label: "Command Centre" },
          { href: "/dashboard/property/cases", label: "All Cases" },
        ]}
      />

      {query.success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Registry action completed.</p> : null}
      {query.error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{decodeURIComponent(query.error)}</p> : null}

      <CaseSummaryCards detail={detail} />

      <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <div className="space-y-6">
          <Panel title="Property Summary" icon={FileText}>
            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Application Reference" value={detail.application_reference ?? "—"} />
              <Info label="NPIN" value={detail.property.npin ?? "Pending approval"} />
              <Info label="Property Type" value={detail.property.property_type.replaceAll("_", " ")} />
              <Info label="Area" value={[detail.property.area_size, detail.property.area_unit].filter(Boolean).join(" ") || "—"} />
              <Info label="Case Status" value={<PropertyStatusBadge status={detail.status} />} />
              <Info label="Priority" value={detail.priority} />
            </div>
          </Panel>

          <Panel title="Location" icon={MapPin}>
            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Traditional Description" value={address?.traditional_description ?? "—"} />
              <Info label="Street" value={address?.street ?? "—"} />
              <Info label="Plot / Block" value={[address?.plot, address?.block].filter(Boolean).join(" / ") || "—"} />
              <Info label="Coordinates" value={address?.centroid_latitude && address?.centroid_longitude ? `${address.centroid_latitude}, ${address.centroid_longitude}` : "—"} />
            </div>
          </Panel>

          <Panel title="GIS / Boundary Review" icon={MapPin}>
            <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
              <GeometryPreview geometry={geometry} />
              <div className="space-y-3">
                <Info label="Verification Status" value={geometry?.verification_status?.replaceAll("_", " ") ?? "No geometry"} />
                <Info label="Source" value={geometry?.source?.replaceAll("_", " ") ?? "—"} />
                <Info label="Coordinate System" value={geometry?.coordinate_system ?? "—"} />
                <Info label="Survey Plan" value={geometry?.survey_plan_number ?? "—"} />
                <Info label="Surveyor" value={geometry?.surveyor_name ?? "—"} />
                <Info label="Area Estimate" value={[geometry?.area_value, geometry?.area_unit].filter(Boolean).join(" ") || "—"} />
              </div>
            </div>
            {overlaps.length ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                Potential boundary overlap detected. Registry review required. This is a warning, not a legal determination.
              </div>
            ) : null}
            <div className="mt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Boundary history</p>
              <GeometryHistory events={geometryEvents} />
            </div>
            {canMutate && geometry ? (
              <form action={reviewGeometryAction} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
                <input type="hidden" name="case_id" value={detail.id} />
                <input className={inputClass} name="geometry_note" placeholder="Boundary review note" />
                <div className="flex flex-wrap gap-2">
                  <button name="geometry_action" value="verify" className="rounded-xl bg-[#008751] px-3 py-2 text-xs font-black text-white">Verify Boundary</button>
                  <button name="geometry_action" value="request_correction" className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-black text-amber-800">Request Correction</button>
                  <button name="geometry_action" value="reject" className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700">Reject</button>
                </div>
              </form>
            ) : null}
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-5 text-slate-500">Map boundaries are subject to registry verification. This is not a legal survey. Official survey records prevail.</p>
          </Panel>

          <Panel title="Ownership Review" icon={Users}>
            <div className="space-y-3">
              {detail.owners.map((owner) => (
                <div key={owner.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-[#06172f]">{owner.owner_name || "Unnamed owner"}</p>
                      <p className="mt-1 text-xs text-slate-500">{owner.owner_type.replaceAll("_", " ")} · {owner.ownership_percentage ?? "—"}%</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{owner.verification_status.replaceAll("_", " ")}</span>
                  </div>
                  {canMutate ? (
                    <form action={reviewOwnerAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                      <input type="hidden" name="case_id" value={detail.id} />
                      <input type="hidden" name="owner_id" value={owner.id} />
                      <input className={inputClass} name="review_note" placeholder="Ownership review note" />
                      <div className="flex gap-2">
                        <button name="owner_action" value="verify" className="rounded-xl bg-[#008751] px-3 py-2 text-xs font-black text-white">Verify</button>
                        <button name="owner_action" value="clarify" className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-black text-amber-800">Clarify</button>
                        <button name="owner_action" value="reject" className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700">Reject</button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Document Verification" icon={ShieldCheck}>
            <div className="space-y-3">
              {detail.documents.map((document) => (
                <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-[#06172f]">{document.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{document.document_type.replaceAll("_", " ")} · {document.file_name ?? "metadata only"}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{document.status.replaceAll("_", " ")}</span>
                  </div>
                  {canMutate ? (
                    <form action={reviewDocumentAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                      <input type="hidden" name="case_id" value={detail.id} />
                      <input type="hidden" name="document_id" value={document.id} />
                      <input className={inputClass} name="review_note" placeholder="Document review note" />
                      <div className="flex gap-2">
                        <button name="document_action" value="approve" className="rounded-xl bg-[#008751] px-3 py-2 text-xs font-black text-white">Approve</button>
                        <button name="document_action" value="reject" className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700">Reject</button>
                        <button name="document_action" value="request_replacement" className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-black text-amber-800">Request Replacement</button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ))}
              {!detail.documents.length ? <p className="text-sm text-slate-500">No document records attached.</p> : null}
            </div>
          </Panel>

          <Panel title="Certificate Preview" icon={CheckCircle2}>
            <CertificatePreview detail={detail} />
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Assignment" icon={UserCheck}>
            {canOverride ? (
              <form action={assignRegistryCaseAction} className="space-y-3">
                <input type="hidden" name="case_id" value={detail.id} />
                <select name="assigned_to" defaultValue={detail.assigned_to ?? ""} className={inputClass}>
                  <option value="">Unassigned</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email || user.id}</option>)}
                </select>
                <select name="assignment_role" defaultValue="land_registry_officer" className={inputClass}>
                  {assignmentRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input className={inputClass} name="notes" placeholder="Assignment note" />
                <button className="w-full rounded-xl bg-[#06172f] px-4 py-3 text-sm font-black text-white" type="submit">Update Assignment</button>
              </form>
            ) : <p className="text-sm text-slate-500">Read-only access.</p>}
          </Panel>

          <Panel title="Decision Panel" icon={AlertCircle}>
            {canMutate ? (
              <form action={updateCaseDecisionAction} className="space-y-3">
                <input type="hidden" name="case_id" value={detail.id} />
                <select name="decision" className={inputClass} defaultValue="under_review">
                  {decisionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <textarea className={textareaClass} name="decision_note" placeholder="Decision notes" />
                <button className="w-full rounded-xl bg-[#06172f] px-4 py-3 text-sm font-black text-white" type="submit">Record Decision</button>
              </form>
            ) : <p className="text-sm text-slate-500">Read-only access.</p>}
          </Panel>

          <Panel title="NPIN & Credential" icon={ShieldCheck}>
            <p className="text-sm leading-6 text-slate-600">Official NPIN and credential issuance is available only after approval or verification.</p>
            {canMutate ? (
              <form action={issueNpinCredentialAction} className="mt-4">
                <input type="hidden" name="case_id" value={detail.id} />
                <button className="w-full rounded-xl bg-[#008751] px-4 py-3 text-sm font-black text-white" type="submit">Issue NPIN & Credential</button>
              </form>
            ) : null}
            {canMutate ? (
              <form action={generateCertificateAction} className="mt-3">
                <input type="hidden" name="case_id" value={detail.id} />
                <button className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-[#06172f]" type="submit">Generate Certificate</button>
              </form>
            ) : null}
          </Panel>

          <Panel title="Comments" icon={FileText}>
            {canMutate ? (
              <form action={addCaseCommentAction} className="space-y-3">
                <input type="hidden" name="case_id" value={detail.id} />
                <textarea className={textareaClass} name="comment" placeholder="Add registry comment" required />
                <select name="visibility" className={inputClass} defaultValue="internal">
                  <option value="internal">Internal only</option>
                  <option value="applicant_visible">Applicant visible</option>
                </select>
                <button className="w-full rounded-xl bg-[#06172f] px-4 py-3 text-sm font-black text-white" type="submit">Add Comment</button>
              </form>
            ) : null}
            <div className="mt-4 space-y-3">
              {detail.comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-sm font-bold text-[#06172f]">{comment.comment}</p>
                  <p className="mt-1 text-xs text-slate-500">{comment.visibility.replaceAll("_", " ")} · {new Date(comment.created_at).toLocaleString("en-NG")}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Timeline & Audit" icon={FileText}>
            <Timeline detail={detail} />
          </Panel>
        </aside>
      </section>

      <Link href="/dashboard/property/cases" className="inline-flex rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-[#06172f]">Back to Cases</Link>
    </main>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-[#008751]"><Icon className="h-5 w-5" /></span>
        <h2 className="text-xl font-black text-[#06172f]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-2 font-black capitalize text-[#06172f]">{value}</div>
    </div>
  );
}
