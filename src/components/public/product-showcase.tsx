"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Factory,
  MapPinned,
  QrCode,
  ShieldCheck,
} from "lucide-react";

export type ProductStatus =
  | "Live"
  | "Available"
  | "Pilot"
  | "Controlled demonstration"
  | "Programme capability"
  | "Public verification surface"
  | "Coming soon";

export type ProductPreviewKind =
  | "identity"
  | "operations"
  | "compliance"
  | "revenue"
  | "guides"
  | "impact"
  | "clusters"
  | "property"
  | "association"
  | "finance";

export type ProductShowcaseItem = {
  id: string;
  tab: string;
  title: string;
  eyebrow: string;
  status: ProductStatus;
  description: string;
  cta: { label: string; href: string };
  kind: ProductPreviewKind;
};

export const FICTIONAL_BUSINESSES = [
  "Eko Fresh Foods Ltd",
  "Kano Spice Mills",
  "Mainland Garments",
  "Abuja Creative Hub",
  "Rivers Logistics Services",
  "Benue Agro Processing Cooperative",
];

export const HOMEPAGE_SHOWCASE: ProductShowcaseItem[] = [
  {
    id: "identity",
    tab: "Business Identity",
    title: "A trusted profile a business can carry across the ecosystem.",
    eyebrow: "Digital identity",
    status: "Live",
    description: "DBIN turns onboarding information into a structured business profile, credential-ready record and public verification pathway.",
    cta: { label: "Explore business identity", href: "/platform/business-identity" },
    kind: "identity",
  },
  {
    id: "operations",
    tab: "Business Operations",
    title: "Operating records that make small businesses easier to understand.",
    eyebrow: "Invoices, receipts and records",
    status: "Available",
    description: "MSMEs can use DBIN workspace tools to organise invoices, receipts, quotes, basic records and readiness evidence.",
    cta: { label: "Explore business tools", href: "/platform/business-tools" },
    kind: "operations",
  },
  {
    id: "compliance",
    tab: "Compliance & Tax",
    title: "Readiness workflows before official regulatory integration.",
    eyebrow: "Evidence and readiness",
    status: "Pilot",
    description: "DBIN supports compliance checklists, evidence submission, reminders and tax-readiness visibility without claiming official filing or remittance.",
    cta: { label: "Explore compliance", href: "/platform/compliance" },
    kind: "compliance",
  },
  {
    id: "revenue",
    tab: "Revenue Intelligence",
    title: "Revenue visibility from business activity signals.",
    eyebrow: "Controlled demonstration",
    status: "Controlled demonstration",
    description: "NRS-oriented previews show how invoice-derived exposure, VAT signals and readiness indicators can support public-sector intelligence.",
    cta: { label: "Explore intelligence", href: "/platform/intelligence" },
    kind: "revenue",
  },
  {
    id: "guides",
    tab: "Revenue Guides",
    title: "Field support for formalisation and readiness engagement.",
    eyebrow: "Operating model",
    status: "Programme capability",
    description: "Revenue Guide previews demonstrate how cohorts, follow-ups and readiness journeys can be coordinated through DBIN.",
    cta: { label: "View programmes", href: "/programmes" },
    kind: "guides",
  },
  {
    id: "impact",
    tab: "Impact Intelligence",
    title: "Programme evidence, risk and executive reporting in one view.",
    eyebrow: "Programme intelligence",
    status: "Programme capability",
    description: "Impact previews show how interventions, KPIs, evidence, risks and executive dashboards can be organised for institutional programmes.",
    cta: { label: "Explore intelligence", href: "/platform/intelligence" },
    kind: "impact",
  },
  {
    id: "clusters",
    tab: "Industrial Programmes",
    title: "Cluster participation and productive-sector readiness.",
    eyebrow: "LCDBO and clusters",
    status: "Pilot",
    description: "LCDBO and cluster previews show MSME enrolment, cluster interest, readiness and participation workflows powered by DBIN.",
    cta: { label: "Explore LCDBO", href: "/lcdbo" },
    kind: "clusters",
  },
  {
    id: "property",
    tab: "Property Intelligence",
    title: "Privacy-safe public verification for property credentials.",
    eyebrow: "DLPI public surface",
    status: "Public verification surface",
    description: "The property layer demonstrates how DBIN principles extend to physical assets through public NPIN verification and safe public records.",
    cta: { label: "Explore property verification", href: "/property" },
    kind: "property",
  },
];

export const PRODUCT_AUDIT_NOTES = [
  "Public verification, sample credential, marketplace, LCDBO and property public routes are safe to show directly.",
  "MSME workspace, invoices, compliance, payments and dashboards are safe only as fictional/redacted product frames.",
  "NRS, Revenue Guides, Impact Intelligence and Risk Flags are private or controlled workspaces; public storytelling must use stylised previews only.",
  "No public product preview should fetch dashboard data, internal UUIDs, personal identifiers, real tax identifiers or invoice recipient details.",
];

const statusStyles: Record<ProductStatus, string> = {
  Live: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Available: "border-teal-200 bg-teal-50 text-teal-800",
  Pilot: "border-amber-200 bg-amber-50 text-amber-900",
  "Controlled demonstration": "border-blue-200 bg-blue-50 text-blue-800",
  "Programme capability": "border-violet-200 bg-violet-50 text-violet-800",
  "Public verification surface": "border-cyan-200 bg-cyan-50 text-cyan-800",
  "Coming soon": "border-slate-200 bg-slate-100 text-slate-700",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-center text-[11px] font-black uppercase leading-4 tracking-[0.12em] xl:whitespace-nowrap ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  inverse = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  inverse?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <p className={`text-xs font-black uppercase tracking-[0.18em] ${inverse ? "text-emerald-300" : "text-emerald-700"}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-black tracking-[-0.03em] md:text-5xl ${inverse ? "text-white" : "text-slate-950"}`}>{title}</h2>
      {description ? <p className={`mt-4 text-base leading-7 ${inverse ? "text-emerald-50/80" : "text-slate-600"}`}>{description}</p> : null}
    </div>
  );
}

export function ProductFrame({
  kind,
  title,
  status,
  className = "",
}: {
  kind: ProductPreviewKind;
  title?: string;
  status?: ProductStatus;
  className?: string;
}) {
  const frameTitle = title ?? previewTitle(kind);
  return (
    <article
      aria-label={`${frameTitle}. Fictional product preview using demonstration data.`}
      className={`min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </div>
        <p className="truncate text-xs font-bold text-slate-300">{frameTitle}</p>
        {status ? <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-200">{status}</span> : <span />}
      </div>
      <div className="bg-[linear-gradient(135deg,#f8fafc_0%,#ecfdf5_100%)] p-4 sm:p-5">
        {renderPreview(kind)}
      </div>
    </article>
  );
}

export function ProductTabShowcase({ items = HOMEPAGE_SHOWCASE }: { items?: ProductShowcaseItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const active = items.find((item) => item.id === activeId) ?? items[0];
  if (!active) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Product showcase"
            title="See the DBIN ecosystem in action"
            description="Fictional, privacy-safe previews show how the platform feels across business, institutional and programme workflows."
          />
          <Link href="/platform" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-950 transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            Explore platform <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-7 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="DBIN product previews">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active.id === item.id}
              aria-controls={`product-panel-${item.id}`}
              id={`product-tab-${item.id}`}
              onClick={() => setActiveId(item.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                active.id === item.id ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
              }`}
            >
              {item.tab}
            </button>
          ))}
        </div>
        <div
          id={`product-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`product-tab-${active.id}`}
          className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"
        >
          <div>
            <ProductStatusBadge status={active.status} />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{active.eyebrow}</p>
            <h3 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-4xl">{active.title}</h3>
            <p className="mt-4 text-base leading-7 text-slate-600">{active.description}</p>
            <Link href={active.cta.href} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              {active.cta.label} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ProductFrame kind={active.kind} status={active.status} />
        </div>
      </div>
    </section>
  );
}

export function CapabilityProofCard({
  title,
  text,
  status,
  href,
  icon: Icon = CheckCircle2,
}: {
  title: string;
  text: string;
  status: ProductStatus;
  href?: string;
  icon?: typeof CheckCircle2;
}) {
  const content = (
    <article className="h-full min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ProductStatusBadge status={status} />
      </div>
      <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
      {href ? <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-700">Learn more <ArrowRight className="h-4 w-4" /></p> : null}
    </article>
  );

  return href ? <Link href={href} className="block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">{content}</Link> : content;
}

export function BeforeAfterJourney({
  steps,
}: {
  steps: Array<{ before?: string; title: string; text: string; status?: ProductStatus }>;
}) {
  return (
    <ol className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
      {steps.map((step, index) => (
        <li key={step.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-emerald-700">Step {index + 1}</p>
          {step.status ? <div className="mt-3"><ProductStatusBadge status={step.status} /></div> : null}
          <h3 className="mt-4 text-lg font-black text-slate-950">{step.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function CaseStudyProof({
  items,
}: {
  items: Array<{ label: string; challenge: string; capability: string; demonstrates: string; next: string; status: ProductStatus; href?: string }>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {items.map((item) => (
        <article key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <ProductStatusBadge status={item.status} />
          <h3 className="mt-4 text-xl font-black text-slate-950">{item.label}</h3>
          <dl className="mt-4 space-y-3 text-sm leading-6">
            <div><dt className="font-black text-slate-900">Challenge</dt><dd className="text-slate-600">{item.challenge}</dd></div>
            <div><dt className="font-black text-slate-900">DBIN capability</dt><dd className="text-slate-600">{item.capability}</dd></div>
            <div><dt className="font-black text-slate-900">Demonstrates</dt><dd className="text-slate-600">{item.demonstrates}</dd></div>
            <div><dt className="font-black text-slate-900">Next stage</dt><dd className="text-slate-600">{item.next}</dd></div>
          </dl>
          {item.href ? (
            <Link href={item.href} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-700">
              Open example <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function previewTitle(kind: ProductPreviewKind) {
  const titles: Record<ProductPreviewKind, string> = {
    identity: "DBIN Business Identity",
    operations: "MSME Operations Workspace",
    compliance: "Compliance Readiness Centre",
    revenue: "Revenue Intelligence Centre",
    guides: "Revenue Guide Operations",
    impact: "Impact Intelligence",
    clusters: "LCDBO Cluster Workspace",
    property: "Property Verification Surface",
    association: "Association Member Portfolio",
    finance: "Finance Readiness View",
  };
  return titles[kind];
}

function renderPreview(kind: ProductPreviewKind) {
  if (kind === "identity") return <IdentityPreview />;
  if (kind === "operations") return <OperationsPreview />;
  if (kind === "compliance") return <CompliancePreview />;
  if (kind === "revenue") return <RevenuePreview />;
  if (kind === "guides") return <GuidesPreview />;
  if (kind === "impact") return <ImpactPreview />;
  if (kind === "clusters") return <ClustersPreview />;
  if (kind === "property") return <PropertyPreview />;
  if (kind === "association") return <AssociationPreview />;
  return <FinancePreview />;
}

function IdentityPreview() {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div className="rounded-2xl border border-emerald-200 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Verified business credential</p>
        <h3 className="mt-3 text-2xl font-black text-slate-950">Eko Fresh Foods Ltd</h3>
        <p className="mt-1 text-sm text-slate-600">Food Processing • Lagos • DBIN-DEMO-LAG-2048</p>
        <div className="mt-4 grid gap-2 text-sm">
          {["Profile complete", "Credential issued", "Public verification enabled"].map((item) => (
            <p key={item} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> {item}
            </p>
          ))}
        </div>
      </div>
      <div className="grid place-items-center rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <QrCode className="h-20 w-20 text-slate-800" aria-hidden="true" />
        <p className="mt-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Scan to verify</p>
      </div>
    </div>
  );
}

function OperationsPreview() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Invoices", "₦2.4m"],
          ["Receipts", "18"],
          ["Outstanding", "₦320k"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs font-bold uppercase text-slate-500">
          <span>Invoice</span><span>Status</span><span>Amount</span>
        </div>
        {[
          ["INV-DEMO-2041", "Paid", "₦480,000"],
          ["INV-DEMO-2042", "Outstanding", "₦320,000"],
          ["INV-DEMO-2043", "Draft", "₦145,000"],
        ].map(([invoice, status, amount]) => (
          <div key={invoice} className="grid grid-cols-3 gap-2 border-b border-slate-100 py-3 text-sm last:border-b-0">
            <span className="font-bold text-slate-900">{invoice}</span>
            <span className="text-slate-600">{status}</span>
            <span className="text-right font-bold text-slate-900">{amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompliancePreview() {
  return (
    <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-2xl bg-emerald-700 p-5 text-white">
        <p className="text-xs font-bold uppercase text-emerald-100">Readiness score</p>
        <p className="mt-3 text-5xl font-black">74%</p>
        <p className="mt-2 text-sm text-emerald-50">Demo readiness, not an official compliance rating.</p>
      </div>
      <div className="space-y-2">
        {[
          ["Business registration evidence", "Approved"],
          ["Tax readiness profile", "Under review"],
          ["Renewal reminder", "Due in 21 days"],
          ["Document evidence", "Requested"],
        ].map(([label, status]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
            <span className="font-bold text-slate-900">{label}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenuePreview() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Invoice exposure", "₦84.6m"],
          ["VAT signal", "₦6.3m"],
          ["Readiness", "62%"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-slate-950 p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Derived insight</p>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          Kano Spice Mills and Benue Agro Processing Cooperative show strong invoice activity but require readiness follow-up.
        </p>
      </div>
    </div>
  );
}

function GuidesPreview() {
  return (
    <div className="space-y-3">
      {[
        ["Amina Revenue Guide Desk", "Lagos Mainland", "24 businesses", "8 follow-ups"],
        ["Musa Revenue Guide Desk", "Kano Municipal", "31 businesses", "11 follow-ups"],
        ["Zainab Revenue Guide Desk", "Abuja Municipal", "19 businesses", "5 follow-ups"],
      ].map(([guide, area, businesses, followUps]) => (
        <div key={guide} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <div>
            <p className="font-black text-slate-950">{guide}</p>
            <p className="text-sm text-slate-500">{area}</p>
          </div>
          <p className="text-sm font-bold text-slate-700">{businesses}</p>
          <p className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">{followUps}</p>
        </div>
      ))}
    </div>
  );
}

function ImpactPreview() {
  return (
    <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase text-slate-500">Programme health</p>
        {[
          ["LCDBO readiness", "Healthy", "82%"],
          ["Evidence confidence", "Watchlist", "68%"],
          ["Open risk flags", "Attention", "4"],
        ].map(([label, status, value]) => (
          <div key={label} className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-slate-800">{label}</span>
            <span className="text-sm text-slate-500">{status}</span>
            <span className="font-black text-slate-950">{value}</span>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-emerald-700 p-4 text-white">
        <RadarIcon />
        <p className="mt-4 text-lg font-black">Executive briefing ready</p>
        <p className="mt-2 text-sm text-emerald-50">Snapshot, evidence and risk signals prepared for institutional review.</p>
      </div>
    </div>
  );
}

function ClustersPreview() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Southwest Leather Hub", "750 MSME target", "Baseline mapping"],
        ["Agro Processing Pilot", "1,200 MSME target", "Concept"],
        ["Technology Park", "900 MSME target", "Concept"],
      ].map(([name, target, status]) => (
        <div key={name} className="rounded-2xl bg-white p-4 shadow-sm">
          <Factory className="h-5 w-5 text-emerald-700" />
          <p className="mt-4 font-black text-slate-950">{name}</p>
          <p className="mt-2 text-sm text-slate-500">{target}</p>
          <p className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{status}</p>
        </div>
      ))}
    </div>
  );
}

function PropertyPreview() {
  return (
    <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-2xl bg-slate-950 p-5 text-white">
        <MapPinned className="h-7 w-7 text-emerald-300" />
        <p className="mt-4 text-sm font-bold uppercase text-slate-300">Public NPIN lookup</p>
        <p className="mt-2 text-2xl font-black">NPIN-DEMO-24001</p>
        <p className="mt-2 text-sm text-slate-300">Verified • Public-safe profile</p>
      </div>
      <div className="space-y-2">
        {["Credential status", "Registry category", "State visibility", "Privacy notice"].map((item) => (
          <p key={item} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-700" /> {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function AssociationPreview() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase text-slate-500">Benue Agro Processing Cooperative</p>
        <p className="mt-2 text-2xl font-black text-slate-950">126 member records</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {["Bulk onboarding", "Member verification", "Programme matching"].map((item) => (
          <p key={item} className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{item}</p>
        ))}
      </div>
    </div>
  );
}

function FinancePreview() {
  return (
    <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase text-slate-500">Readiness</p>
        <p className="mt-2 text-4xl font-black text-slate-950">B+</p>
        <p className="mt-2 text-sm text-slate-500">Evidence-backed, not a credit score.</p>
      </div>
      <div className="space-y-2">
        {["Verified identity", "Invoice activity", "Compliance evidence", "Programme participation"].map((item) => (
          <p key={item} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" /> {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function RadarIcon() {
  return (
    <div className="relative h-20 w-20 rounded-full border border-emerald-200/60">
      <div className="absolute inset-4 rounded-full border border-emerald-200/40" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200" />
      <div className="absolute left-1/2 top-1/2 h-px w-9 origin-left bg-emerald-200" />
    </div>
  );
}
