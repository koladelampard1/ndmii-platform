"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type NavbarProps = {
  isAuthenticated?: boolean;
  roleLabel?: string;
};

export function Navbar({ isAuthenticated = false, roleLabel }: NavbarProps) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          NDMII Platform
        </Link>
        <nav className="flex flex-wrap items-center gap-3">
          <Link href="/marketplace" className="text-sm text-slate-600 hover:text-slate-900">
            Marketplace
          </Link>
          <Link href="/verify" className="text-sm text-slate-600 hover:text-slate-900">
            Verify ID
          </Link>
          <Link href="/resources" className="text-sm text-slate-600 hover:text-slate-900">
            Resources
          </Link>
          <Link href="/partners" className="text-sm text-slate-600 hover:text-slate-900">
            Partners
          </Link>
          <Link href="/about" className="text-sm text-slate-600 hover:text-slate-900">
            About
          </Link>
          {isAuthenticated ? (
            <>
              {roleLabel ? (
                <span className="rounded bg-slate-100 px-2 py-1 text-xs uppercase tracking-wide text-slate-600">
                  {roleLabel}
                </span>
              ) : null}
              <Link href="/logout">
                <Button size="sm" variant="secondary">
                  Sign out
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/signup/msme">
                <Button size="sm" variant="secondary">Register</Button>
              </Link>
              <Link href="/login">
                <Button size="sm">Sign in</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
