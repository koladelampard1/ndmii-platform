import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  FileClock,
  History,
  IdCard,
  KeyRound,
  Link2,
  MessageSquareText,
  QrCode,
  ShieldAlert,
  UserRound,
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
  if (["active", "approved", "ready", "valid", "likely_valid", "normal"].includes(normalized)) return "emerald";
  if (["pending", "watch", "expiring_soon", "renewal_pending"].includes(normalized)) return "amber";
  if (["suspended", "revoked", "expired", "missing", "likely_invalid", "critical", "elevated"].includes(normalized)) return "rose";
  if (["unavailable"].includes(normalized)) return "slate";
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
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Credential lifecycle workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{credential.businessName}</h1>
          <p className="mt-2 break-all text-sm font-bold text-slate-500">{credential.ndmiiId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill value={credential.lifecycleState} />
          <StatusPill value={credential.attentionLevel} />
          <StatusPill value={credential.publicVerificationReadiness} />
        </div>
      </div>
    </header>
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
              { label: "Issued", value: formatDateTime(credential.issuedAt) },
              { label: "Approved", value: formatDateTime(credential.approvedAt) },
              { label: "Suspended", value: formatDateTime(credential.suspendedAt) },
              { label: "Revoked", value: formatDateTime(credential.revokedAt) },
            ]} />
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
              <StatusPill value={workspace.readiness.publicVerification} />
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{workspace.readiness.publicReason}</p>
            <p className="mt-2 text-xs font-bold text-slate-500">{credential.publicVerificationRoute ? "Public verification route is present. Raw token is hidden in this workspace." : "No public verification route available."}</p>
            {workspace.readiness.safeTestHref ? (
              <Link href={workspace.readiness.safeTestHref} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
                <Link2 className="h-3.5 w-3.5" />Test public link
              </Link>
            ) : null}
          </SectionCard>

          <SectionCard title="Expiry and renewal" icon={CalendarClock}>
            <DataGrid rows={[
              { label: "Expires", value: formatDateTime(credential.expiryAt) },
              { label: "Expiry state", value: <StatusPill value={credential.expiryState} /> },
              { label: "Renewal requested", value: formatDateTime(credential.renewalRequestedAt) },
              { label: "Lifecycle state", value: <StatusPill value={credential.lifecycleState} /> },
            ]} />
          </SectionCard>

          <SectionCard title="Issuance history" icon={BadgeCheck}>
            <Timeline items={workspace.issuanceHistory} emptyText="No issuance or activation history is available." />
          </SectionCard>

          <SectionCard title="Regeneration history" icon={KeyRound}>
            <Timeline items={workspace.regenerationHistory} emptyText="No token regeneration history is available." />
          </SectionCard>

          <SectionCard title="Attention signals" icon={ShieldAlert}>
            <div className="flex flex-wrap gap-2">
              {workspace.attentionSignals.length ? workspace.attentionSignals.map((signal) => (
                <span key={signal.code} className={`inline-flex rounded-full border px-3 py-2 text-xs font-black ${toneClasses[statusTone(signal.severity)]}`}>{signal.label}</span>
              )) : <StatusPill value="normal" fallback="No attention signals" />}
            </div>
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

          <SectionCard title="Lifecycle timeline" icon={FileClock}>
            <Timeline items={workspace.timeline} emptyText="No lifecycle events recorded yet." />
          </SectionCard>
        </div>

        <LifecycleDecisionPanel
          credentialId={credential.credentialId}
          role={ctx.role}
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
      </div>
    </section>
  );
}
