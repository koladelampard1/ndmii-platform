import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { verifyPublicProperty } from "@/lib/data/public-property-explorer";
import { PropertyHero, PropertyPublicShell, VerificationPanel } from "@/components/property/public-property-explorer";

export const dynamic = "force-dynamic";

export default async function PropertyVerifyPage({ searchParams }: { searchParams: Promise<{ npin?: string; token?: string }> }) {
  const params = await searchParams;
  const npin = params.npin?.trim() ?? "";
  const token = params.token?.trim() ?? "";
  const hasLookup = Boolean(npin || token);
  const result = hasLookup ? await verifyPublicProperty({ npin, token }) : null;

  return (
    <PropertyPublicShell>
      <PropertyHero
        eyebrow="Public Property Verification"
        title="Verify an NPIN or property credential token."
        description="Confirm whether a property identity credential is valid, revoked, superseded, suspended, expired or unknown. Verification is timestamped and privacy-safe."
        searchDefault={npin}
      />

      <section className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-[#008751]"><ShieldCheck className="h-6 w-6" /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#008751]">Lookup</p>
              <h1 className="text-2xl font-black text-[#06172f]">Enter NPIN or verification token</h1>
            </div>
          </div>
          <form className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input name="npin" defaultValue={npin} placeholder="NPIN-LA-000000001" className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none ring-[#008751] focus:ring-2" />
            <input name="token" defaultValue={token} placeholder="Verification token or QR token" className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none ring-[#008751] focus:ring-2" />
            <button className="h-12 rounded-xl bg-[#06172f] px-5 text-sm font-black text-white">Verify</button>
          </form>
          <p className="mt-3 text-sm leading-6 text-slate-500">QR verification endpoint preparation uses the same token lookup model. A dedicated QR UI is intentionally not part of this phase.</p>
        </div>

        {result ? (
          <VerificationPanel result={result} />
        ) : (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-2xl font-black text-[#06172f]">No lookup submitted</h2>
            <p className="mt-2 text-slate-500">Enter an NPIN or a public verification token to confirm registry credential status.</p>
          </div>
        )}

        <div className="rounded-[2rem] bg-[#06172f] p-6 text-white">
          <h2 className="text-2xl font-black">Verification statuses</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {["Valid", "Revoked", "Superseded", "Suspended", "Expired", "Unknown"].map((status) => (
              <div key={status} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm font-bold">{status}</div>
            ))}
          </div>
          <Link href="/property/help" className="mt-5 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-black text-[#06172f]">Understand verification</Link>
        </div>
      </section>
    </PropertyPublicShell>
  );
}
