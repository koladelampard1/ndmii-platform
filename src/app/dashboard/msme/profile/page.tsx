import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";

export default async function MsmeProfileOverviewPage() {
  const workspace = await getProviderWorkspaceContext();

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <article className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">MSME identity mapping</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="text-slate-500">Business name</dt><dd className="font-medium">{workspace.msme.business_name}</dd></div>
          <div><dt className="text-slate-500">MSME ID</dt><dd className="font-medium">{workspace.msme.msme_id}</dd></div>
          <div><dt className="text-slate-500">Owner</dt><dd>{workspace.msme.owner_name}</dd></div>
          <div><dt className="text-slate-500">State / LGA</dt><dd>{workspace.msme.state}{workspace.msme.lga ? `, ${workspace.msme.lga}` : ""}</dd></div>
        </dl>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Provider profile mapping</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="text-slate-500">Provider profile ID</dt><dd className="font-mono text-xs">{workspace.provider.id}</dd></div>
          <div><dt className="text-slate-500">Display name</dt><dd>{workspace.provider.display_name}</dd></div>
          <div><dt className="text-slate-500">Public slug</dt><dd>{workspace.provider.public_slug}</dd></div>
          <div><dt className="text-slate-500">Trust score</dt><dd>{workspace.provider.trust_score}</dd></div>
        </dl>
      </article>
    </section>
  );
}
