function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ServerErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestId = firstValue(params.requestId);
  const source = firstValue(params.source);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Service unavailable</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">We could not complete this request.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Please try again shortly. If this continues, share the request reference with the DBIN support team.
        </p>
        {source ? <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Source: {source}</p> : null}
        {requestId ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">Request reference: {requestId}</p> : null}
        <a href="/login" className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800">
          Return to sign in
        </a>
      </section>
    </main>
  );
}
