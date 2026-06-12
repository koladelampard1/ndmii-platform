import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, LockKeyhole, ShieldCheck } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";

export default async function AdminPortalPage() {
  const ctx = await getCurrentUserContext();
  const isAdmin = ctx.role === "admin";

  if (ctx.role !== "public" && !isAdmin) {
    redirect("/access-denied");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950 sm:px-6 lg:grid lg:place-items-center">
      <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-slate-950 p-8 text-white sm:p-12">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Restricted workspace
              </span>
              <h1 className="mt-8 text-4xl font-black tracking-tight sm:text-5xl">DBIN Admin Portal</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                Secure operational access for authorized DBIN administrators managing identity, verification, association, and platform workflows.
              </p>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <LockKeyhole className="h-5 w-5 text-emerald-300" />
                  <p className="mt-3 text-sm font-bold">Authentication retained</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Existing DBIN sessions and server-side role checks remain authoritative.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Building2 className="h-5 w-5 text-emerald-300" />
                  <p className="mt-3 text-sm font-bold">Role-scoped access</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">This hostname does not grant permissions or bypass existing workspace guards.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center p-8 sm:p-12">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Administration gateway</p>
            <h2 className="mt-3 text-2xl font-black text-slate-950">
              {isAdmin ? `Welcome${ctx.fullName ? `, ${ctx.fullName}` : ""}` : "Authorized personnel only"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isAdmin
                ? "Your active DBIN session has the required administrative role."
                : "Sign in with an authorized administrator account to continue to the operations console."}
            </p>

            <Link
              href={isAdmin ? "/dashboard/admin" : "/login"}
              className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800"
            >
              {isAdmin ? "Open admin console" : "Sign in securely"}
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link href="/" className="mt-3 text-center text-sm font-semibold text-slate-500 hover:text-slate-800">
              Return to DBIN
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
