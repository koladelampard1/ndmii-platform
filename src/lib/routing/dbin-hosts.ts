export type DbinHostSurface = "marketing" | "app" | "admin" | "verify" | "unknown";

type HostRoutingConfig = {
  marketingHosts: Set<string>;
  appHosts: Set<string>;
  adminHosts: Set<string>;
  verifyHosts: Set<string>;
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
  return "unknown";
}

export function resolveDbinRewritePath(surface: DbinHostSurface, pathname: string) {
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
