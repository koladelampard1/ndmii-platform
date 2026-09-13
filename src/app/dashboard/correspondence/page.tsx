import Link from "next/link";
import { ArrowRight, Check, Clock3, FileText, PenLine, Send, Sparkles } from "lucide-react";
import { getCorrespondenceRepresentativeAuthority, getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceActionBanner, RepresentativeStatusBadge } from "@/app/dashboard/correspondence/_components";
import { institutionLabelForRepresentative, representativeBuckets } from "@/lib/lcdbo-correspondence/representative-workflow";
import type { LcdboCorrespondenceRecord } from "@/lib/lcdbo-correspondence/types";

type SearchParams = Promise<{ success?: string; error?: string }>;

function LetterRow({ record }: { record: LcdboCorrespondenceRecord }) {
  return (
    <Link href={`/dashboard/correspondence/${record.id}`} className="group grid gap-3 border-b border-slate-100 px-5 py-4 transition last:border-0 hover:bg-emerald-50/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-bold text-slate-950">{record.subject}</p>
          <RepresentativeStatusBadge record={record} />
        </div>
        <p className="mt-1 truncate text-sm text-slate-500">{record.reference}</p>
      </div>
      <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800">
        Open letter <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export default async function CorrespondenceDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { success, error } = await searchParams;
  const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const authority = ctx.appUserId ? await getCorrespondenceRepresentativeAuthority({ actorUserId: ctx.appUserId, programmeId: programme.id, client: supabase }) : null;
  const buckets = representativeBuckets(snapshot.records, authority);
  const institution = authority ? institutionLabelForRepresentative(authority.representative_role) : "LCDBO";
  const currentWork = [...buckets.needsMyAction, ...buckets.readyToSend, ...buckets.drafts, ...buckets.waitingForOtherParty]
    .filter((record, index, records) => records.findIndex((item) => item.id === record.id) === index)
    .slice(0, 6);
  const primary = buckets.needsMyAction.length
    ? { eyebrow: "Your attention is needed", title: `Review ${buckets.needsMyAction.length} ${buckets.needsMyAction.length === 1 ? "letter" : "letters"}`, description: "A letter from the other institution is waiting for your decision and signature.", href: "/dashboard/correspondence/my-work", label: "Review now", icon: FileText }
    : buckets.readyToSend.length
      ? { eyebrow: "Ready for dispatch", title: `Send ${buckets.readyToSend.length} approved ${buckets.readyToSend.length === 1 ? "letter" : "letters"}`, description: "Both institutional signatures are complete. The final letter is ready to send.", href: "/dashboard/correspondence/ready-to-send", label: "Send letter", icon: Send }
      : { eyebrow: "Start here", title: "Create an official letter", description: "Write the subject and body. Your institutional signature and the counterparty workflow are handled securely.", href: "/dashboard/correspondence/create", label: "Create letter", icon: PenLine };
  const PrimaryIcon = primary.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CorrespondenceActionBanner success={success} error={error} />

      <section className="relative overflow-hidden rounded-[2rem] bg-[#073c35] px-6 py-7 text-white shadow-xl shadow-emerald-950/10 sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-emerald-50">
              <Sparkles className="h-4 w-4 text-emerald-300" /> {institution} workspace
            </div>
            <p className="mt-6 text-sm font-bold text-emerald-200">{primary.eyebrow}</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">{primary.title}</h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-emerald-50/80">{primary.description}</p>
          </div>
          <Link href={primary.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 text-base font-black text-emerald-950 shadow-lg shadow-black/10 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <PrimaryIcon className="h-5 w-5" /> {primary.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {snapshot.schemaUnavailable ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5" role="alert">
          <h2 className="font-black text-amber-950">Workspace setup is incomplete</h2>
          <p className="mt-1 text-sm leading-6 text-amber-800">Correspondence records are temporarily unavailable. Contact the workspace administrator.</p>
        </section>
      ) : null}

      <section aria-labelledby="how-it-works" className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-emerald-700">A simple two-party process</p>
            <h2 id="how-it-works" className="mt-1 text-2xl font-black tracking-tight text-slate-950">From draft to official letter</h2>
          </div>
          <Link href="/dashboard/correspondence/register" className="text-sm font-bold text-slate-600 transition hover:text-emerald-800">View all correspondence</Link>
        </div>
        <ol className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { icon: PenLine, number: "01", title: "Create", text: "Write the subject and format the letter body." },
            { icon: Check, number: "02", title: "Sign together", text: "Your institution signs, then the other party countersigns." },
            { icon: Send, number: "03", title: "Send", text: "Dispatch the approved PDF from the secure workspace." },
          ].map((step) => (
            <li key={step.number} className="rounded-2xl bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><step.icon className="h-5 w-5" /></span>
                <span className="text-sm font-black text-slate-300">{step.number}</span>
              </div>
              <h3 className="mt-5 text-base font-black text-slate-950">{step.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="current-work" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div>
            <h2 id="current-work" className="text-xl font-black tracking-tight text-slate-950">Current work</h2>
            <p className="mt-1 text-sm text-slate-600">Only letters still moving through the workflow.</p>
          </div>
          <div className="flex items-center gap-4 text-sm font-bold text-slate-600">
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-amber-600" /> {buckets.waitingForOtherParty.length} waiting</span>
            <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4 text-emerald-700" /> {buckets.drafts.length} drafts</span>
          </div>
        </div>
        {currentWork.length ? currentWork.map((record) => <LetterRow key={record.id} record={record} />) : (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Check className="h-6 w-6" /></span>
            <h3 className="mt-4 text-lg font-black text-slate-950">You are all caught up</h3>
            <p className="mt-1 text-sm text-slate-600">There are no letters waiting for action.</p>
          </div>
        )}
      </section>
    </div>
  );
}
