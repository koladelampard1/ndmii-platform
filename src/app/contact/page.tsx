import Link from "next/link";
import { PublicPageShell } from "@/components/public/public-page-shell";

const SUPPORT_TOPICS = [
  "Business Identity Number onboarding",
  "Business identity verification follow-up",
  "Association & cluster enrollment",
  "Regulatory desk (FCCPC/FIRS)",
  "Public procurement & buyer access",
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
        <h2 className="text-xl font-semibold text-slate-900">Digital Business Identity Network (DBIN) support request</h2>
        <p className="mt-2 text-sm text-slate-600">Use this intake form to reach DBIN service teams supporting MSMEs, associations, regulators, and public-sector buyers.</p>
        <form className="mt-5 grid gap-3 md:grid-cols-2">
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Full name" />
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Email address" />
          <select defaultValue={params.topic ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2">
            <option value="">Select Digital Business Identity Network (DBIN) topic</option>
            {SUPPORT_TOPICS.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
          <textarea className="min-h-28 rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" placeholder="Describe your request, business identity number (if available), and expected timeline." />
          <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 md:col-span-2 md:w-fit">
            Submit request
          </button>
        </form>
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Digital Business Identity Network (DBIN) live channels are being expanded. For immediate access to core DBIN services, use the routes below.
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
