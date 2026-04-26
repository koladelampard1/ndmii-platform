"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type NavbarProps = {
  isAuthenticated?: boolean;
  roleLabel?: string;
};

export function Navbar({ isAuthenticated = false, roleLabel }: NavbarProps) {
  return (
    <header className="border-b border-emerald-950/70 bg-emerald-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight sm:text-lg">
          BIN Business Identity Network
        </Link>
        <nav className="flex w-full flex-wrap items-center gap-2 text-xs sm:w-auto sm:gap-3 sm:text-sm">
          <Link href="/marketplace" className="text-sm text-emerald-100/90 hover:text-white">
            Marketplace
          </Link>
          <Link href="/verify" className="text-sm text-emerald-100/90 hover:text-white">
            Verify Business ID
          </Link>
          <Link href="/resources" className="text-sm text-emerald-100/90 hover:text-white">
            Resources
          </Link>
          <Link href="/partners" className="text-sm text-emerald-100/90 hover:text-white">
            Partners
          </Link>
          <Link href="/about" className="text-sm text-emerald-100/90 hover:text-white">
            About
          </Link>
          <Link href="/contact" className="text-sm text-emerald-100/90 hover:text-white">
            Contact
          </Link>
          {isAuthenticated ? (
            <>
              {roleLabel ? (
                <span className="rounded bg-emerald-900/80 px-2 py-1 text-xs uppercase tracking-wide text-emerald-100">
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
              <Link href="/register/msme" className="sm:ml-1">
                <Button size="sm" className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">Register</Button>
              </Link>
              <Link href="/login">
                <Button size="sm" variant="secondary">Sign in</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
