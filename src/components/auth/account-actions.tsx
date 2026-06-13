"use client";

import Link from "next/link";
import { LogOut, UserRoundCog } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type AccountActionsProps = {
  className?: string;
  dark?: boolean;
  compact?: boolean;
};

export function AccountActions({
  className,
  dark = false,
  compact = false,
}: AccountActionsProps) {
  const pathname = usePathname();
  const switchHref = `/logout?switch=1&returnTo=${encodeURIComponent(pathname || "/")}`;
  const baseClass = dark
    ? "border-white/15 text-slate-200 hover:bg-white/10 hover:text-white"
    : "border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Link
        href="/logout"
        className={cn(
          "inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition",
          baseClass,
        )}
      >
        <LogOut className="h-4 w-4" />
        Logout
      </Link>
      <Link
        href={switchHref}
        className={cn(
          "inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 transition",
          baseClass,
        )}
      >
        <UserRoundCog className="h-4 w-4 shrink-0" />
        <span>
          <span className="block text-xs font-semibold">Switch account</span>
          {!compact ? (
            <span className={cn("block text-[10px]", dark ? "text-slate-400" : "text-slate-500")}>
              Sign out and choose another role
            </span>
          ) : null}
        </span>
      </Link>
    </div>
  );
}
