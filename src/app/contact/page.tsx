import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/public/public-page-shell";

export const metadata: Metadata = {
  title: "Contact DBIN",
  description:
    "Contact DBIN for MSME support, institutional partnership, government or regulator briefings, financial institution interest, programme partnership, media enquiries and technical support.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact DBIN",
    description: "Reach the DBIN operations desk for support, verification, partnership and institutional briefing requests.",
    url: "/contact",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact DBIN",
    description: "Reach DBIN support and partnership pathways through a privacy-aware public contact page.",
  },
};

const SUPPORT_TOPICS = [
  "MSME support",
  "Business identity verification",
  "Institutional partnership",
  "Government or regulator briefing",
  "Financial institution interest",
  "Programme partnership",
  "Media enquiry",
  "Technical support",
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const params = await searchParams;

  return (
    <PublicPageShell
      eyebrow="Contact Digital Business Identity Network (DBIN)"
      title="Reach the Digital Business Identity Network (DBIN) operations desk"
      description="Need support with identity onboarding, verification, regulatory workflows, or institutional adoption? Send a request and DBIN will route it to the right team."
      primaryCta={{ label: "Register your business", href: "/register/msme" }}
      secondaryCta={{ label: "Open verification portal", href: "/verify" }}
    >
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Digital Business Identity Network (DBIN) support request</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Use this lightweight intake guide to prepare a support or partnership request. Formal CRM routing can be connected later without changing the public journey.
            </p>
          </div>
          <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-900">
            Intake routing
          </span>
        </div>

        <form className="mt-5 grid gap-4 md:grid-cols-2" aria-describedby="contact-privacy-note contact-routing-note">
          <label className="grid gap-1 text-sm font-semibold text-slate-800">
            Full name
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" placeholder="Your name" autoComplete="name" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-800">
            Email address
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" placeholder="you@example.com" type="email" autoComplete="email" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-800 md:col-span-2">
            Request intent
            <select defaultValue={params.topic ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              <option value="">Select DBIN request type</option>
            {SUPPORT_TOPICS.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-800 md:col-span-2">
            Request summary
            <textarea className="min-h-28 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" placeholder="Describe your request, DBIN credential reference if available, organisation type, and expected timeline. Do not include NIN, BVN, private documents, passwords or payment details." />
          </label>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <Link href="/register/msme" className="inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              Register your business
            </Link>
            <Link href="/partners" className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              Partnership pathways
            </Link>
          </div>
        </form>
        <p id="contact-privacy-note" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          Privacy note: send only information necessary to route your enquiry. Sensitive personal identifiers, passwords, private documents and payment data should not be submitted through public contact forms.
        </p>
        <div id="contact-routing-note" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          DBIN live contact channels are being expanded. For immediate access to core DBIN services, use the routes below.
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/marketplace" className="font-medium">Browse marketplace</Link>
            <Link href="/verify" className="font-medium">Verify Business Identity Number</Link>
            <Link href="/partners" className="font-medium">Institutional partnership pathways</Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
