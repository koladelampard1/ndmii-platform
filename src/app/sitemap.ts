import type { MetadataRoute } from "next";

const PUBLIC_ROUTES = [
  "",
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
  "/sample-id-card",
  "/lcdbo",
  "/lcdbo/about",
  "/lcdbo/clusters",
  "/lcdbo/opportunities",
  "/lcdbo/partners",
  "/lcdbo/resources",
  "/lcdbo/contact",
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

  return PUBLIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route.startsWith("/lcdbo") || route.startsWith("/property") ? 0.8 : 0.7,
  }));
}
