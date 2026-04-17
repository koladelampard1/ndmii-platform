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
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          NDMII Platform
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/search" className="text-sm text-slate-600">
            Marketplace
          </Link>
          <Link href="/verify" className="text-sm text-slate-600">
            Verify ID
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
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
