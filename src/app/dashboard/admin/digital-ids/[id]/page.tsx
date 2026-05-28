import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Gauge,
  FileClock,
  History,
  IdCard,
  KeyRound,
  MessageSquareText,
  QrCode,
  ShieldCheck,
  ShieldAlert,
  Store,
  UserRound,
  UserCog,
} from "lucide-react";
import { LifecycleDecisionPanel } from "@/components/admin/digital-ids/lifecycle-decision-panel";
import { requireRole } from "@/lib/data/authorization-scope";
import { getAdminDigitalIdWorkspace, type AdminDigitalIdWorkspace } from "@/lib/data/admin-digital-id-workspace";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Tone = "emerald" | "amber" | "rose" | "blue" | "slate" | "violet";

const toneClasses: Record<Tone, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

function humanize(value: string | null | undefined, fallback = "Unavailable") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").toLowerCase();
  if (["active", "approved", "ready", "valid", "likely_valid", "normal", "healthy", "trusted", "absolute", "on track"].includes(normalized)) return "emerald";
  if (["pending", "watch", "warning", "expiring_soon", "expiring_7_days", "expiring_30_days", "renewal_pending", "relative", "approaching sla", "unassigned"].includes(normalized)) return "amber";
  if (["suspended", "revoked", "expired", "missing", "likely_invalid", "invalid", "publicly_disabled", "critical", "elevated", "restricted", "revoked_trust", "overdue_renewal", "expired_active", "breached"].includes(normalized)) return "rose";
  if (["unavailable", "missing", "paused"].includes(normalized)) return "slate";
  return "blue";
}

function StatusPill({ value, fallback = "Unavailable" }: { value: string | null | undefined; fallback?: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses[statusTone(value ?? fallback)]}`}>{humanize(value, fallback)}</span>;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: typeof IdCard; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SignalList({ signals, emptyText = "No signals detected." }: { signals: Array<{ code: string; label: string; severity: "watch" | "elevated" | "critical" }>; emptyText?: string }) {
  if (!signals.length) return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">{emptyText}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((signal) => (
        <span key={signal.code} className={`inline-flex rounded-full border px-3 py-2 text-xs font-black ${toneClasses[statusTone(signal.severity)]}`}>{signal.label}</span>
      ))}
    </div>
  );
}

function DataGrid({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{row.label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Timeline({ items, emptyText }: { items: AdminDigitalIdWorkspace["timeline"]; emptyText: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">{emptyText}</p>;
  return (
    <ol className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-950">{humanize(item.action)}</p>
            <p className="text-xs font-bold text-slate-500">{formatDateTime(item.createdAt)}</p>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-700">{item.summary}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{humanize(item.actorRole)}</p>
        </li>
      ))}
    </ol>
  );
}

function SourceBanner({ sources }: { sources: AdminDigitalIdWorkspace["sources"] }) {
  const unavailable = Object.entries(sources).filter(([, source]) => !source.available);
  if (!unavailable.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      Some lifecycle workspace sources are unavailable: {unavailable.map(([name]) => name).join(", ")}. Optional governance fields may show as unavailable.
    </div>
  );
}

function Header({ workspace }: { workspace: AdminDigitalIdWorkspace }) {
  const { credential } = workspace;
  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <Link href="/dashboard/admin/digital-ids" className="inline-flex items-center gap-2 text-sm font-black text-emerald-800 hover:text-emerald-950">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to digital ID queue
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Credential intelligence workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{credential.businessName}</h1>
          <p className="mt-2 break-all text-sm font-bold text-slate-500">{credential.ndmiiId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill value={credential.lifecycleState} />
          <StatusPill value={credential.attentionLevel} />
          <StatusPill value={workspace.readiness.publicVerificationPosture} />
          <StatusPill value={workspace.trust.posture} />
          <StatusPill value={credential.sla.state} />
        </div>
      </div>
    </header>
  );
}

function OperationalSidePanel({ workspace, role, currentUserId }: { workspace: AdminDigitalIdWorkspace; role: Awaited<ReturnType<typeof requireRole>>["role"]; currentUserId: string }) {
  const { credential } = workspace;
  return (
    <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Operational posture</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">{humanize(credential.lifecycleState)}</h2>
          </div>
          <StatusPill value={role} />
        </div>
        <dl className="mt-4 grid gap-3">
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Assigned reviewer</dt><dd className="mt-1 text-sm font-black text-slate-950">{credential.assignedReviewerName ?? "Unassigned"}</dd></div>
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Assigned admin</dt><dd className="mt-1 text-sm font-black text-slate-950">{credential.assignedAdminName ?? "Unassigned"}</dd></div>
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">SLA posture</dt><dd className="mt-1"><StatusPill value={credential.sla.state} /></dd><dd className="mt-1 text-xs font-semibold text-slate-600">{credential.sla.explanation}</dd></div>
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Assignment inactivity</dt><dd className="mt-1 text-sm font-black text-slate-950">{credential.assignment.inactivityHours === null ? "Unavailable" : `${credential.assignment.inactivityHours} hour(s)`}</dd></div>
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Attention level</dt><dd className="mt-1"><StatusPill value={credential.attentionLevel} /></dd></div>
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Credential health</dt><dd className="mt-1 flex flex-wrap gap-2"><StatusPill value={workspace.readiness.publicVerificationPosture} /><StatusPill value={workspace.expiry.posture} /><StatusPill value={workspace.trust.posture} /></dd></div>
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Regenerations</dt><dd className="mt-1 text-sm font-black text-slate-950">{workspace.regeneration.total.toLocaleString()}</dd></div>
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Last activity</dt><dd className="mt-1 text-sm font-black text-slate-950">{formatDateTime(workspace.timeline[0]?.createdAt ?? credential.updatedAt)}</dd></div>
        </dl>
      </section>

      <LifecycleDecisionPanel
        credentialId={credential.credentialId}
        role={role}
        currentUserId={currentUserId}
        status={workspace.lifecycle.status}
        allowedActions={workspace.lifecycle.allowedActions}
        internalNotes={credential.internalNotes}
        assignedReviewerId={credential.assignedReviewerId}
        assignedReviewerName={credential.assignedReviewerName}
        assignedAdminId={credential.assignedAdminId}
        assignedAdminName={credential.assignedAdminName}
        reviewers={workspace.reviewers}
        regenerationCount={credential.regenerationCount}
        lastRegeneratedAt={credential.lastRegeneratedAt}
      />
    </aside>
  );
}

export default async function AdminDigitalIdWorkspacePage({ params }: PageProps) {
  const ctx = await requireRole(["admin", "super_admin", "reviewer", "fccpc_officer", "firs_officer"]);
  const { id } = await params;
  const supabase = await createServiceRoleSupabaseClient();
  const workspace = await getAdminDigitalIdWorkspace(supabase, id);
  if (!workspace) notFound();
  const { credential } = workspace;

  return (
    <section className="mx-auto max-w-[1500px] space-y-5">
      <Header workspace={workspace} />
      <SourceBanner sources={workspace.sources} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <SectionCard title="Credential summary" icon={IdCard}>
            <DataGrid rows={[
              { label: "Credential ID", value: credential.credentialId },
              { label: "BIN / MSME ID", value: credential.msmeId },
              { label: "Credential status", value: <StatusPill value={credential.credentialStatus} /> },
              { label: "Lifecycle version", value: credential.lifecycleVersion.toLocaleString() },
              { label: "Time in current lifecycle", value: credential.currentLifecycleAgeHours === null ? "Unavailable" : `${credential.currentLifecycleAgeHours} hour(s)` },
              { label: "Current lifecycle started", value: formatDateTime(credential.currentLifecycleStartedAt) },
              { label: "Issued", value: formatDateTime(credential.issuedAt) },
              { label: "Approved", value: formatDateTime(credential.approvedAt) },
              { label: "Suspended", value: formatDateTime(credential.suspendedAt) },
              { label: "Revoked", value: formatDateTime(credential.revokedAt) },
            ]} />
          </SectionCard>

          <SectionCard title="SLA and assignment governance" icon={UserCog}>
            <DataGrid rows={[
              { label: "SLA category", value: humanize(credential.sla.category) },
              { label: "SLA state", value: <StatusPill value={credential.sla.state} /> },
              { label: "SLA started", value: formatDateTime(credential.sla.startedAt) },
              { label: "SLA due", value: formatDateTime(credential.sla.dueAt) },
              { label: "Elapsed", value: credential.sla.elapsedHours === null ? "Unavailable" : `${credential.sla.elapsedHours} hour(s)` },
              { label: "Remaining", value: credential.sla.remainingHours === null ? "Unavailable" : `${credential.sla.remainingHours} hour(s)` },
              { label: "Assigned at", value: formatDateTime(credential.assignedAt) },
              { label: "Assigned by", value: credential.assignedByName ?? "Unavailable" },
              { label: "Reassignments", value: credential.reassignedCount.toLocaleString() },
              { label: "Last reassignment", value: formatDateTime(credential.lastReassignmentAt) },
            ]} />
            <p className="mt-3 text-xs font-bold text-slate-500">{credential.sla.explanation}</p>
          </SectionCard>

          <SectionCard title="Reviewer handoff history" icon={History}>
            <Timeline items={workspace.handoffHistory} emptyText="No assignment handoff history is available." />
          </SectionCard>

          <SectionCard title="Assignment history" icon={UserCog}>
            <Timeline items={workspace.assignmentHistory} emptyText="No assignment mutations have been recorded." />
          </SectionCard>

          <SectionCard title="MSME summary" icon={UserRound}>
            <DataGrid rows={[
              { label: "Business name", value: credential.businessName },
              { label: "Owner", value: credential.ownerName },
              { label: "State / sector", value: [credential.state, credential.sector].filter(Boolean).join(" / ") || "Unavailable" },
              { label: "MSME review", value: <StatusPill value={credential.msmeReviewStatus} /> },
              { label: "MSME verification", value: <StatusPill value={credential.msmeVerificationStatus} /> },
              { label: "CAC / TIN", value: `${credential.cacMasked ?? "Unavailable"} / ${credential.tinMasked ?? "Unavailable"}` },
            ]} />
          </SectionCard>

          <SectionCard title="Public verification readiness" icon={QrCode}>
            <div className="flex flex-wrap gap-2">
              <StatusPill value={workspace.readiness.tokenHash} fallback="Token hash" />
              <StatusPill value={workspace.readiness.signature} fallback="Signature" />
              <StatusPill value={workspace.readiness.qr} fallback="QR" />
              <StatusPill value={workspace.readiness.publicVerificationPosture} />
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{workspace.readiness.publicReason}</p>
            <DataGrid rows={[
              { label: "Public route binding", value: workspace.readiness.routeAvailable ? "Present" : "Missing" },
              { label: "QR generation readiness", value: <StatusPill value={workspace.readiness.qr} /> },
              { label: "Public disabled state", value: ["revoked", "suspended"].includes(credential.credentialStatus) ? "Disabled by lifecycle" : "Not disabled" },
              { label: "Duplicate route bindings", value: workspace.readiness.routeDuplicateCount > 1 ? `${workspace.readiness.routeDuplicateCount} credentials` : "None detected" },
            ]} />
            <p className="mt-3 text-xs font-bold text-slate-500">Operational signal only. Verification URLs, raw tokens, token hashes, signatures, and internal route IDs are not displayed.</p>
          </SectionCard>

          <SectionCard title="Public verification intelligence" icon={ShieldCheck}>
            <DataGrid rows={[
              { label: "Token hash", value: <StatusPill value={workspace.readiness.tokenHash} /> },
              { label: "Signature", value: <StatusPill value={workspace.readiness.signature} /> },
              { label: "Route available", value: workspace.readiness.routeAvailable ? "Yes" : "No" },
              { label: "Validity window", value: `${formatDateTime(credential.approvedAt)} to ${formatDateTime(workspace.expiry.expiresAt)}` },
              { label: "Expiry posture", value: <StatusPill value={workspace.expiry.posture} /> },
              { label: "Verification URL health", value: <StatusPill value={workspace.readiness.publicVerificationPosture} /> },
            ]} />
          </SectionCard>

          <SectionCard title="QR / route health" icon={QrCode}>
            <SignalList signals={workspace.qrRouteSignals} emptyText="QR route binding has no detected mismatch, duplicate, disabled-route, or expiry reachability signals." />
            <DataGrid rows={[
              { label: "Last regeneration", value: formatDateTime(workspace.regeneration.lastRegeneratedAt) },
              { label: "Regeneration count", value: workspace.regeneration.total.toLocaleString() },
              { label: "Invalidation timestamp", value: formatDateTime(workspace.regeneration.routeInvalidatedAt) },
              { label: "Lifecycle version", value: credential.lifecycleVersion.toLocaleString() },
            ]} />
          </SectionCard>

          <SectionCard title="Expiry and renewal" icon={CalendarClock}>
            <DataGrid rows={[
              { label: "Expires", value: formatDateTime(credential.expiryAt) },
              { label: "Expiry posture", value: <StatusPill value={workspace.expiry.posture} /> },
              { label: "Expiry countdown", value: workspace.expiry.daysUntilExpiry === null ? "Unavailable" : `${workspace.expiry.daysUntilExpiry} day(s)` },
              { label: "Renewal requested", value: formatDateTime(credential.renewalRequestedAt) },
              { label: "Renewal pending duration", value: workspace.expiry.renewalPendingDays === null ? "Not pending" : `${workspace.expiry.renewalPendingDays} day(s)` },
              { label: "Lifecycle state", value: <StatusPill value={credential.lifecycleState} /> },
            ]} />
          </SectionCard>

          <SectionCard title="Regeneration intelligence" icon={KeyRound}>
            <DataGrid rows={[
              { label: "Total regenerations", value: workspace.regeneration.total.toLocaleString() },
              { label: "Recent regenerations", value: workspace.regeneration.recent.length.toLocaleString() },
              { label: "Suspicious burst", value: workspace.regeneration.suspiciousBurst ? <StatusPill value="warning" /> : "No" },
              { label: "Revocation / reissue cycle", value: workspace.regeneration.repeatedRevocationReissue ? <StatusPill value="warning" /> : "No" },
            ]} />
            <div className="mt-4">
              <Timeline items={workspace.regeneration.recent} emptyText="No recent regeneration activity is available." />
            </div>
          </SectionCard>

          <SectionCard title="Anomaly signals" icon={ShieldAlert}>
            {credential.anomalySignals.length ? (
              <div className="space-y-2">
                {credential.anomalySignals.map((signal) => (
                  <div key={signal.code} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <StatusPill value={signal.severity} />
                    <p className="mt-2 text-sm font-black text-slate-900">{signal.label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{signal.explanation}</p>
                  </div>
                ))}
              </div>
            ) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No anomaly signals detected.</p>}
          </SectionCard>

          <SectionCard title="Lifecycle frequency and stability" icon={Gauge}>
            <div className="grid gap-3 md:grid-cols-2">
              {workspace.lifecycleFrequencySummary.length ? workspace.lifecycleFrequencySummary.map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{humanize(item.label)}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{item.value.toLocaleString()}</p>
                </div>
              )) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No lifecycle frequency data available.</p>}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {workspace.stabilityIndicators.map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{item.value}</p>
                  <div className="mt-2"><StatusPill value={item.posture} /></div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Compliance and verification posture" icon={Gauge}>
            <DataGrid rows={[
              { label: "Verification review", value: <StatusPill value={credential.verificationReviewStatus} /> },
              { label: "MSME verification", value: <StatusPill value={credential.msmeVerificationStatus} /> },
              { label: "Compliance", value: <StatusPill value={credential.complianceStatus} /> },
              { label: "Compliance score", value: credential.complianceScore ?? "Unavailable" },
            ]} />
          </SectionCard>

          <SectionCard title="Marketplace / trust signals" icon={Store}>
            <div className="flex flex-wrap gap-2"><StatusPill value={workspace.trust.posture} /></div>
            <ul className="mt-3 space-y-2">
              {workspace.trust.reasons.map((reason) => <li key={reason} className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">{reason}</li>)}
            </ul>
          </SectionCard>

          <SectionCard title="Risk indicators" icon={ShieldAlert}>
            <SignalList signals={workspace.attentionSignals} emptyText="No attention-level risk indicators detected." />
          </SectionCard>

          <SectionCard title="Lifecycle timeline" icon={FileClock}>
            <Timeline items={workspace.timeline} emptyText="No lifecycle events recorded yet." />
          </SectionCard>

          <SectionCard title="Internal notes" icon={MessageSquareText}>
            {workspace.notes.length ? (
              <div className="space-y-2">
                {workspace.notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">{note.note}</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{humanize(note.actorRole)} - {formatDateTime(note.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No internal lifecycle notes recorded.</p>}
          </SectionCard>

          <SectionCard title="Lifecycle matrix" icon={History}>
            <div className="grid gap-2 md:grid-cols-2">
              {workspace.lifecycle.matrix.map((item) => (
                <div key={item.from} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">{humanize(item.from)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{item.actions.length ? item.actions.map((value) => humanize(value)).join(", ") : "No lifecycle actions"}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Issuance history" icon={BadgeCheck}>
            <Timeline items={workspace.issuanceHistory} emptyText="No issuance or activation history is available." />
          </SectionCard>
        </div>

        <OperationalSidePanel workspace={workspace} role={ctx.role} currentUserId={ctx.appUserId ?? ""} />
      </div>
    </section>
  );
}
