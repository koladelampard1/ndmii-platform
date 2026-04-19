import Link from "next/link";
import { BadgeCheck, QrCode } from "lucide-react";
import { PublicPageShell } from "@/components/public/public-page-shell";

export default function SampleIdCardPage() {
  return (
    <PublicPageShell
      eyebrow="Sample Credential"
      title="Preview the NDMII digital MSME ID card"
      description="This sample illustrates the data points and trust markers institutions and customers can verify through the public portal."
      primaryCta={{ label: "Register your business", href: "/signup/msme" }}
      secondaryCta={{ label: "Verify an MSME", href: "/verify" }}
      highlights={[
        "Each MSME ID maps to a unique public verification route.",
        "QR references resolve to verification pages with status and validation checks.",
        "Credential trust is improved by KYC simulation outcomes and profile quality.",
      ]}
    >
      <section className="mt-8 grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Official sample</p>
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-slate-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Abuja AutoCare Services Ltd.</h2>
                <p className="text-sm text-slate-600">Owner: Ibrahim Usman • Automotive Services</p>
                <p className="mt-2 text-sm text-slate-600">NDMII ID: <span className="font-semibold text-slate-900">NDMII-FCT-108168205</span></p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified
              </span>
            </div>
            <div className="mt-4 grid grid-cols-[110px_1fr] gap-4">
              <div className="flex h-24 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">PASSPORT</div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-900">QR Verification Zone</p>
                <p className="mt-1">Scans resolve to official NDMII verification details.</p>
                <QrCode className="mt-2 h-10 w-10 text-slate-700" />
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">How this card is used</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Share your MSME ID or QR with customers, buyers, or institutions.</li>
            <li>2. They validate the credential through the public verification portal.</li>
            <li>3. Verification confirms business identity, status, and trust indicators.</li>
          </ol>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Need a live credential? Complete MSME onboarding and publish your public profile.
          </div>
          <Link href="/for-msmes" className="mt-4 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800">
            Read MSME onboarding guide
          </Link>
        </article>
      </section>
    </PublicPageShell>
  );
}
