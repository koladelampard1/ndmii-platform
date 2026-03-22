import { supabase } from "@/lib/supabase/client";

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; role?: string; entity?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  let query = supabase
    .from("activity_logs")
    .select("id,action,entity_type,entity_id,metadata,created_at,actor_user_id,users(full_name,role)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.action) query = query.eq("action", params.action);
  if (params.entity) query = query.eq("entity_type", params.entity);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to);

  const { data: logs } = await query;
  const filtered = (logs ?? []).filter((log) => (!params.role || log.users?.role === params.role));

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Audit Trail Viewer</h1>
      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-5">
        <input name="action" defaultValue={params.action} placeholder="action type" className="rounded border px-2 py-2 text-sm" />
        <input name="role" defaultValue={params.role} placeholder="role" className="rounded border px-2 py-2 text-sm" />
        <input name="entity" defaultValue={params.entity} placeholder="entity type" className="rounded border px-2 py-2 text-sm" />
        <input name="from" defaultValue={params.from} placeholder="from date" className="rounded border px-2 py-2 text-sm" />
        <input name="to" defaultValue={params.to} placeholder="to date" className="rounded border px-2 py-2 text-sm" />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Filter logs</button>
      </form>
      <div className="space-y-2">
        {filtered.length === 0 && <p className="rounded border bg-white p-6 text-center text-slate-500">No audit entries match current filters.</p>}
        {filtered.map((log) => (
          <details key={log.id} className="rounded-xl border bg-white p-3">
            <summary className="cursor-pointer text-sm"><strong>{log.action}</strong> • {log.entity_type}:{log.entity_id?.slice(0, 8)} • {new Date(log.created_at).toLocaleString()}</summary>
            <div className="mt-2 text-xs text-slate-600">
              <p>Actor: {log.users?.full_name ?? "System"}</p>
              <p>Role: {log.users?.role ?? "n/a"}</p>
              <p>Entity type: {log.entity_type}</p>
              <p>Entity id: {log.entity_id}</p>
              <pre className="mt-2 overflow-auto rounded bg-slate-100 p-2">{JSON.stringify(log.metadata ?? {}, null, 2)}</pre>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
