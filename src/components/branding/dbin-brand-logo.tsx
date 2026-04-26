import { cn } from "@/lib/utils";

type DbinBrandLogoProps = {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
  compactOnMobile?: boolean;
};

export function DbinBrandLogo({
  className,
  iconClassName,
  textClassName,
  showText = true,
  compactOnMobile = true,
}: DbinBrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "inline-flex h-10 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 text-[0.65rem] font-black tracking-[0.2em] text-white shadow-sm ring-1 ring-emerald-300/60",
          iconClassName,
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 40" className="h-7 w-12" role="img">
          <title>DBIN</title>
          <rect x="1.5" y="1.5" width="61" height="37" rx="11" fill="url(#dbinLogoGradient)" />
          <rect x="1.5" y="1.5" width="61" height="37" rx="11" fill="none" stroke="rgba(255,255,255,0.35)" />
          <defs>
            <linearGradient id="dbinLogoGradient" x1="5" y1="2" x2="59" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#34d399" />
              <stop offset="1" stopColor="#047857" />
            </linearGradient>
          </defs>
          <text
            x="32"
            y="25"
            textAnchor="middle"
            fill="white"
            fontSize="15"
            fontWeight="800"
            fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif"
            letterSpacing="1.5"
          >
            DBIN
          </text>
        </svg>
      </span>
      {showText ? (
        <span className={cn("text-sm font-semibold leading-tight", compactOnMobile ? "hidden sm:inline" : "inline", textClassName)}>
          Digital Business Identity Network (DBIN)
        </span>
      ) : null}
    </span>
  );
}
