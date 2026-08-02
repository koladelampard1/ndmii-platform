import type { MetadataRoute } from "next";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

const PUBLIC_ROUTES = [
  "",
  "/platform",
  "/platform/business-identity",
  "/platform/business-tools",
  "/platform/compliance",
  "/platform/intelligence",
  "/programmes",
  "/about",
  "/partners",
  "/resources",
  "/contact",
  "/for-msmes",
  "/for-associations",
  "/for-financial-institutions",
  "/for-government",
  "/marketplace",
  "/search",
  "/categories",
  "/verify",
  "/ekirs",
  "/sample-id-card",
  "/property",
  "/property/about",
  "/property/explorer",
  "/property/search",
  "/property/verify",
  "/property/resources",
  "/property/help",
  "/privacy",
  "/terms",
  "/cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://dbin.ng";
  const lastModified = new Date();

  const dbinRoutes = PUBLIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" as const : "monthly" as const,
    priority: route === "" ? 1 : route.startsWith("/property") ? 0.8 : 0.7,
  }));

  const lcdboRoutes = ["", "/about", "/clusters", "/opportunities", "/partners", "/resources", "/contact", "/events", "/model"].map((route) => ({
    url: `${LCDBO_CANONICAL_ORIGIN}${route}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: route === "" ? 0.9 : 0.8,
  }));

  return [...dbinRoutes, ...lcdboRoutes];
}
