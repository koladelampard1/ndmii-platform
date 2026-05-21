import Link from "next/link";
import { checkRateLimit } from "@/lib/http/rate-limit";

export default async function LegacyVerifyPage({ params }: { params: Promise<{ msmeId: string }> }) {
  await params;
  const rate = await checkRateLimit({ scope: "verify", limit: 60, windowMs: 60_000 });
  const code = rate.ok ? "token_required" : "rate_limited";
  const message = rate.ok
    ? "Public credential verification now requires the secure QR token link. Raw MSME IDs, DBIN IDs, and UUIDs are not accepted for public verification."
    : "Too many verification attempts. Please retry shortly.";

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-bold">Verification not valid</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Error code: {code}</p>
      <Link href="/verify" className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
        Search credentials
      </Link>
    </main>
  );
}
