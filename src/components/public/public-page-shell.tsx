import type { ReactNode } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { PublicFooter } from "@/components/layout/public-footer";

type PublicPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  highlights?: string[];
  children?: ReactNode;
};

export function PublicPageShell({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  highlights = [],
  children,
}: PublicPageShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#111827_45%,#064e3b_100%)] p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-100 md:text-base">{description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={primaryCta.href} className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
              {primaryCta.label}
            </Link>
            {secondaryCta ? (
              <Link href={secondaryCta.href} className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </div>

        {highlights.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {highlights.map((item) => (
              <article key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                {item}
              </article>
            ))}
          </div>
        ) : null}

        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
