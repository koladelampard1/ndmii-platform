import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-emerald-700">Federal-ready civic tech</p>
        <h1 className="max-w-3xl text-4xl font-bold text-slate-900">Nigeria Digital MSME Identity Infrastructure Initiative</h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          End-to-end platform for MSME onboarding, ID generation, compliance simulation, complaint resolution, and public verification.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/register"><Button>Start onboarding</Button></Link>
          <Link href="/dashboard"><Button variant="secondary">Open dashboard</Button></Link>
        </div>
      </section>
    </main>
  );
}
