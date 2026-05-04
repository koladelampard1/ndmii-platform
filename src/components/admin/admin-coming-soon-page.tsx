import { requireRole } from "@/lib/data/authorization-scope";

type AdminComingSoonPageProps = {
  title: string;
  description: string;
};

export async function AdminComingSoonPage({ title, description }: AdminComingSoonPageProps) {
  await requireRole(["admin"]);

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Admin console</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>

      <article className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Coming soon</p>
        <h2 className="mt-3 text-xl font-semibold text-slate-950">Coming soon</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
          This admin workspace is available for routing and access validation while the full operational module is completed.
        </p>
      </article>
    </section>
  );
}
