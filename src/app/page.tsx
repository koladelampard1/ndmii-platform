import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_45%),linear-gradient(160deg,#020617_0%,#0f172a_40%,#111827_100%)] text-white">
      <Navbar />
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-16 text-center md:pt-24">
        <p className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
          Federal verification service
        </p>
        <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
          Official Public Verification for Nigeria&apos;s Digital MSME IDs
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-200 md:text-lg">
          Confirm a business identity in seconds using the NDMII federal registry.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/verify">
            <Button className="h-12 min-w-[200px] bg-emerald-500 text-slate-950 hover:bg-emerald-400">Verify MSME ID</Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary" className="h-12 min-w-[200px] border border-white/30 bg-white/10 text-white hover:bg-white/20">
              Start MSME onboarding
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
