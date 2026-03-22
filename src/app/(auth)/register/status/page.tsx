import Link from "next/link";

export default async function RegistrationStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ msmeId?: string; status?: string }>;
}) {
  const params = await searchParams;
  const statusLabel = params.status?.replaceAll("_", " ") ?? "pending review";

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-6 py-16">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Onboarding Status</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Registration received successfully</h1>
        <p className="mt-3 text-slate-600">
          MSME ID: <span className="font-semibold text-slate-900">{params.msmeId ?? "Will be issued on review"}</span>
        </p>
        <p className="mt-2 text-slate-600">
          Current review state: <span className="font-semibold capitalize text-amber-700">{statusLabel}</span>
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Review officers validate KYC and compliance profile.</li>
          <li>Approved MSMEs become visible on the public verification portal.</li>
          <li>Your digital identity card unlocks immediately after approval.</li>
        </ul>
      </section>
      <div className="flex flex-wrap gap-3">
        <Link href="/login?message=Registration complete. Sign in to track your onboarding status." className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          Sign in to continue
        </Link>
        <Link href="/verify" className="rounded border px-4 py-2 text-sm">
          Open public verification portal
        </Link>
      </div>
    </main>
  );
}
