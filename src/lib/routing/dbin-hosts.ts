export type DbinHostSurface = "marketing" | "app" | "admin" | "verify" | "boi" | "unknown";

type HostRoutingConfig = {
  marketingHosts: Set<string>;
  appHosts: Set<string>;
  adminHosts: Set<string>;
  verifyHosts: Set<string>;
  boiHosts: Set<string>;
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
  return "unknown";
}

export function resolveDbinRewritePath(surface: DbinHostSurface, pathname: string) {
  if (surface === "boi") {
    if (
      pathname === "/login" ||
      pathname === "/logout" ||
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/")
    ) {
      return null;
    }
    return "/boi";
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

  return null;
}
