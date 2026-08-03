export type DbinHostSurface = "marketing" | "app" | "admin" | "verify" | "boi" | "nrs" | "ekirs" | "lcdbo" | "lands" | "unknown";

export const LCDBO_CANONICAL_HOST = "lcdbo.dbin.ng";
export const LCDBO_CANONICAL_ORIGIN = `https://${LCDBO_CANONICAL_HOST}`;
export const LCDBO_INTERNAL_PUBLIC_ROOT = "/lcdbo";
export const LCDBO_PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/clusters",
  "/clusters/catalogue",
  "/clusters/map",
  "/contact",
  "/events",
  "/model",
  "/opportunities",
  "/partners",
  "/resources",
]);

type HostRoutingConfig = {
  marketingHosts: Set<string>;
  appHosts: Set<string>;
  adminHosts: Set<string>;
  verifyHosts: Set<string>;
  boiHosts: Set<string>;
  nrsHosts: Set<string>;
  ekirsHosts: Set<string>;
  lcdboHosts: Set<string>;
  landsHosts: Set<string>;
  localAppHosts: Set<string>;
};

function normalizeHostname(value: string | null | undefined) {
  const firstValue = value?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!firstValue) return "";

  if (firstValue.startsWith("[")) {
    const closingBracket = firstValue.indexOf("]");
    return closingBracket >= 0 ? firstValue.slice(1, closingBracket) : firstValue;
  }

  return firstValue.split(":")[0] ?? "";
}

function hostSet(value: string | undefined, fallback: string[]) {
  const configuredHosts = value
    ?.split(",")
    .map((host) => normalizeHostname(host))
    .filter(Boolean);

  return new Set(configuredHosts?.length ? configuredHosts : fallback);
}

function getHostRoutingConfig(): HostRoutingConfig {
  return {
    marketingHosts: hostSet(process.env.DBIN_MARKETING_HOSTS, ["dbin.ng", "www.dbin.ng"]),
    appHosts: hostSet(process.env.DBIN_APP_HOSTS, ["app.dbin.ng"]),
    adminHosts: hostSet(process.env.DBIN_ADMIN_HOSTS, ["admin.dbin.ng"]),
    verifyHosts: hostSet(process.env.DBIN_VERIFY_HOSTS, ["verify.dbin.ng"]),
    boiHosts: hostSet(process.env.DBIN_BOI_HOSTS, ["boi.dbin.ng"]),
    nrsHosts: hostSet(process.env.DBIN_NRS_HOSTS, ["nrs.dbin.ng", "nrs.localhost", "nrs.dbin.local"]),
    ekirsHosts: hostSet(process.env.DBIN_EKIRS_HOSTS, ["ekirs.dbin.ng", "ekirs.localhost", "ekirs.dbin.local"]),
    lcdboHosts: hostSet(process.env.DBIN_LCDBO_HOSTS, [LCDBO_CANONICAL_HOST, "lcdbo.com", "www.lcdbo.com", "lcdbo.localhost", "lcdbo.dbin.local"]),
    landsHosts: hostSet(process.env.DBIN_LANDS_HOSTS, ["lands.dbin.ng"]),
    localAppHosts: hostSet(process.env.DBIN_LOCAL_APP_HOSTS, ["localhost", "127.0.0.1", "::1"]),
  };
}

export function resolveDbinHostSurface(hostHeader: string | null | undefined): DbinHostSurface {
  const hostname = normalizeHostname(hostHeader);
  const config = getHostRoutingConfig();

  if (config.localAppHosts.has(hostname) || config.appHosts.has(hostname)) return "app";
  if (config.marketingHosts.has(hostname)) return "marketing";
  if (config.adminHosts.has(hostname)) return "admin";
  if (config.verifyHosts.has(hostname)) return "verify";
  if (config.boiHosts.has(hostname)) return "boi";
  if (config.nrsHosts.has(hostname)) return "nrs";
  if (config.ekirsHosts.has(hostname)) return "ekirs";
  if (config.lcdboHosts.has(hostname)) return "lcdbo";
  if (config.landsHosts.has(hostname)) return "lands";
  return "unknown";
}

function isDirectApplicationPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login?") ||
    pathname === "/logout" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback/") ||
    pathname === "/update-password" ||
    pathname.startsWith("/update-password/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  );
}

function cleanLcdboPublicPath(pathname: string) {
  const withoutTrailingSlash = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (withoutTrailingSlash === LCDBO_INTERNAL_PUBLIC_ROOT) return "/";
  if (withoutTrailingSlash.startsWith(`${LCDBO_INTERNAL_PUBLIC_ROOT}/`)) {
    return withoutTrailingSlash.slice(LCDBO_INTERNAL_PUBLIC_ROOT.length) || "/";
  }
  return withoutTrailingSlash || "/";
}

function isLcdboPublicPath(pathname: string) {
  const publicPath = cleanLcdboPublicPath(pathname);
  return (
    LCDBO_PUBLIC_PATHS.has(publicPath)
    || publicPath.startsWith("/clusters/state/")
    || publicPath.startsWith("/clusters/lga/")
    || (
      publicPath.startsWith("/clusters/")
      && publicPath !== "/clusters/reports"
      && publicPath !== "/clusters/admin"
    )
  );
}

export function getLcdboCanonicalPath(pathname: string) {
  return cleanLcdboPublicPath(pathname);
}

export function resolveDbinCanonicalRedirectUrl(surface: DbinHostSurface, url: URL) {
  const pathname = url.pathname;

  if (surface === "marketing" && (pathname === LCDBO_INTERNAL_PUBLIC_ROOT || pathname.startsWith(`${LCDBO_INTERNAL_PUBLIC_ROOT}/`))) {
    if (!isLcdboPublicPath(pathname)) return null;
    const redirectUrl = new URL(url);
    redirectUrl.protocol = "https:";
    redirectUrl.host = LCDBO_CANONICAL_HOST;
    redirectUrl.pathname = cleanLcdboPublicPath(pathname);
    return redirectUrl;
  }

  if (surface === "lcdbo") {
    if (pathname === "/dashboard") {
      const redirectUrl = new URL(url);
      redirectUrl.pathname = "/dashboard/lcdbo";
      return redirectUrl;
    }

    if (pathname === "/login" && url.searchParams.get("workspace") !== "lcdbo") {
      const redirectUrl = new URL(url);
      redirectUrl.searchParams.set("workspace", "lcdbo");
      return redirectUrl;
    }

    if (pathname === LCDBO_INTERNAL_PUBLIC_ROOT || pathname.startsWith(`${LCDBO_INTERNAL_PUBLIC_ROOT}/`)) {
      const redirectUrl = new URL(url);
      redirectUrl.pathname = cleanLcdboPublicPath(pathname);
      return redirectUrl;
    }
  }

  return null;
}

export function resolveDbinRewritePath(surface: DbinHostSurface, pathname: string) {
  if (surface === "boi") {
    if (isDirectApplicationPath(pathname) || pathname === "/admin" || pathname.startsWith("/admin/")) {
      return null;
    }
    return "/boi";
  }

  if (surface === "nrs") {
    if (isDirectApplicationPath(pathname)) return null;
    if (pathname === "/") return "/nrs";
    if (pathname === "/nrs" || pathname.startsWith("/nrs/")) return null;
    if (pathname === "/verification") return "/verify";
    if (pathname === "/verify" || pathname.startsWith("/verify/")) return null;
    if (pathname === "/register" || pathname.startsWith("/register/")) return null;
    if (pathname === "/contact" || pathname.startsWith("/contact/")) return null;
    return "/nrs";
  }

  if (surface === "ekirs") {
    if (isDirectApplicationPath(pathname)) return null;
    if (pathname === "/") return "/ekirs";
    if (pathname === "/ekirs" || pathname.startsWith("/ekirs/")) return null;
    if (pathname === "/apply" || pathname.startsWith("/apply/")) return `/ekirs${pathname}`;
    if (pathname === "/verification") return "/verify";
    if (pathname === "/verify" || pathname.startsWith("/verify/")) return null;
    if (pathname === "/register" || pathname.startsWith("/register/")) return null;
    if (pathname === "/contact" || pathname.startsWith("/contact/")) return null;
    return "/ekirs";
  }

  if (surface === "lcdbo") {
    if (isDirectApplicationPath(pathname)) return null;
    if (pathname === "/") return LCDBO_INTERNAL_PUBLIC_ROOT;
    if (pathname === LCDBO_INTERNAL_PUBLIC_ROOT || pathname.startsWith(`${LCDBO_INTERNAL_PUBLIC_ROOT}/`)) return null;
    if (isLcdboPublicPath(pathname)) {
      return pathname === "/" ? LCDBO_INTERNAL_PUBLIC_ROOT : `${LCDBO_INTERNAL_PUBLIC_ROOT}${pathname}`;
    }
    if (pathname === "/verification") return "/verify";
    if (pathname === "/verify" || pathname.startsWith("/verify/")) return null;
    if (pathname === "/register" || pathname.startsWith("/register/")) return null;
    if (pathname === "/contact" || pathname.startsWith("/contact/")) return null;
    return null;
  }

  if (surface === "admin") {
    if (pathname === "/") return "/admin";
    if (pathname === "/associations" || pathname.startsWith("/associations/")) {
      return `/admin${pathname}`;
    }
  }

  if (surface === "verify") {
    if (pathname === "/") return "/verify";
    if (pathname === "/c" || pathname.startsWith("/c/")) {
      return `/verify${pathname}`;
    }
  }

  if (surface === "lands") {
    if (
      pathname === "/login" ||
      pathname === "/logout" ||
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/")
    ) {
      return null;
    }
    if (pathname === "/") return "/property";
    if (pathname === "/property" || pathname.startsWith("/property/")) return null;
    return `/property${pathname}`;
  }

  return null;
}
