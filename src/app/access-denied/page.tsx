import Link from "next/link";

type AccessDeniedPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSafeDashboardReturnPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/login" || value.startsWith("/login?")) return null;
  if (value === "/logout" || value.startsWith("/logout?")) return null;
  return value.startsWith("/dashboard") ? value : null;
}

export default async function AccessDeniedPage({ searchParams }: AccessDeniedPageProps) {
  const params = searchParams ? await searchParams : {};
  const workspace = firstValue(params.workspace);
  const safeReturnTo = getSafeDashboardReturnPath(firstValue(params.returnTo)) ?? "/dashboard";
  const isNrsWorkspace = workspace === "nrs";

  return (
    <main className={isNrsWorkspace ? "min-h-screen bg-emerald-950 px-6 py-16" : "mx-auto max-w-2xl px-6 py-16"}>
      <div className={isNrsWorkspace ? "mx-auto max-w-2xl rounded-3xl border border-white/15 bg-white p-8 shadow-2xl shadow-emerald-950/30" : "rounded-xl border border-rose-200 bg-white p-8 shadow-sm"}>
        <p className={isNrsWorkspace ? "text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700" : "text-xs font-semibold uppercase tracking-[0.18em] text-rose-700"}>
          Access Restricted
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          {isNrsWorkspace
            ? "This account does not have access to the NRS workspace."
            : "You do not have permission to access this page."}
        </h1>
        <p className="mt-3 text-slate-600">
          {isNrsWorkspace
            ? "The NRS Formalisation Workspace is available only to authorised NRS, FIRS and platform administration roles. Return to an authorised workspace or contact your administrator."
            : "Your current role cannot view the requested route or record. Return to your assigned workspace."}
        </p>
        <div className="mt-6 flex gap-3">
          <Link href={safeReturnTo} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Go to my dashboard</Link>
          <Link href={isNrsWorkspace ? "/nrs" : "/verify"} className="rounded border px-4 py-2 text-sm">
            {isNrsWorkspace ? "Return to NRS home" : "Open public verification"}
          </Link>
        </div>
      </div>
    </main>
  );
}
