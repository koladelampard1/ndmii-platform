import Link from "next/link";
import { PublicPageShell } from "@/components/public/public-page-shell";

const SUPPORT_TOPICS = [
  "MSME registration support",
  "Verification follow-up",
  "Association onboarding",
  "Institution partnership",
  "Marketplace listing enquiries",
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const params = await searchParams;

  return (
    <PublicPageShell
      eyebrow="Contact"
      title="Talk to the NDMII implementation team"
      description="Need help with onboarding, verification, partnerships, or data quality? Reach out and our team will direct your request to the right desk."
      primaryCta={{ label: "Register your MSME", href: "/register/msme" }}
      secondaryCta={{ label: "Open verification portal", href: "/verify" }}
    >
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Support request</h2>
        <p className="mt-2 text-sm text-slate-600">This environment uses a UI-first intake form. You can still proceed with key public flows while support processing is staged.</p>
        <form className="mt-5 grid gap-3 md:grid-cols-2">
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Full name" />
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Email address" />
          <select defaultValue={params.topic ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2">
            <option value="">Select support topic</option>
            {SUPPORT_TOPICS.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
          <textarea className="min-h-28 rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" placeholder="How can we help?" />
          <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 md:col-span-2 md:w-fit">
            Submit request
          </button>
        </form>
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Live support channel setup is in progress. For immediate platform access, use the guided routes below.
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/marketplace" className="font-medium">Browse marketplace</Link>
            <Link href="/verify" className="font-medium">Verify Business ID</Link>
            <Link href="/partners" className="font-medium">Partnership pathways</Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
