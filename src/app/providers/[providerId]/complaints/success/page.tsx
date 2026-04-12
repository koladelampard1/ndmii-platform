import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";

export default async function PublicComplaintSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { providerId } = await params;
  const query = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-3xl px-6 py-14">
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Complaint submitted</p>
          <h1 className="mt-2 text-2xl font-semibold text-emerald-900">Your complaint has been successfully logged</h1>
          <p className="mt-2 text-sm text-emerald-800">
            Reference: <span className="font-semibold">{query.ref ?? "Pending reference"}</span>. Keep this for follow-up with the provider, association, or regulator.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/providers/${providerId}`} className="inline-flex rounded-xl bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
              Return to provider profile
            </Link>
            <Link href="/search" className="inline-flex rounded-xl border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
              Explore more providers
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
