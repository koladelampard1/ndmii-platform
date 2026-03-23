import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";

const stakeholderCards = [
  { title: "MSMEs", text: "Fast digital onboarding, validated identity issuance, and transparent compliance posture." },
  { title: "Regulators", text: "Unified operating view for KYC simulation, complaints, tax posture, and enforcement workflow." },
  { title: "Associations", text: "Membership governance tools, state/LGA coverage tracking, and sector-level coordination." },
  { title: "Public", text: "Trusted public verification with QR-backed identity checks and clean status visibility." },
];

export default function LandingPage() {
  return (
    <main className="bg-slate-50">
      <Navbar />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-10 text-white shadow-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Federal civic-tech infrastructure</p>
          <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-5xl">Nigeria Digital MSME Identity Infrastructure Initiative (NDMII)</h1>
          <p className="mt-5 max-w-3xl text-lg text-slate-200">
            Government-grade platform for digital onboarding, identity generation, verification, compliance simulation, and NRS operational coordination.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register"><Button>Start onboarding</Button></Link>
            <Link href="/verify"><Button variant="secondary">Verify MSME ID</Button></Link>
            <Link href="/dashboard"><Button variant="secondary">Open dashboards</Button></Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stakeholderCards.map((card) => (
            <article key={card.title} className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{card.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-semibold">Feature overview</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <li>• MSME onboarding wizard with simulated CAC/NIN/BVN/TIN checks</li>
              <li>• Automated digital MSME ID generation with QR verification links</li>
              <li>• Reviewer + compliance workspace with auditable overrides</li>
              <li>• NRS revenue operations for tax, arrears, reliefs, and notices</li>
              <li>• Association management, manufacturer traceability, and exports</li>
              <li>• Responsive role-based dashboards for national operations</li>
            </ul>
          </article>
          <article className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Trust and security</h2>
            <p className="mt-2 text-sm text-slate-600">Role-based access control, simulated service adapters, and end-to-end activity logging support regulator confidence.</p>
            <div className="mt-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
              Data shown is simulation-grade for MVP demonstration and can be replaced by live NIN/BVN/CAC/TIN integrations.
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
