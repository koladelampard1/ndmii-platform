import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/platform",
        "/programmes",
        "/about",
        "/partners",
        "/resources",
        "/contact",
        "/marketplace",
        "/verify",
        "/lcdbo",
        "/property",
      ],
      disallow: [
        "/dashboard",
        "/api",
        "/login",
        "/logout",
        "/register",
        "/signup",
        "/invoice",
        "/verify/c",
        "/activate-account",
        "/auth",
        "/reset-password",
        "/update-password",
        "/association-onboarding",
      ],
    },
    sitemap: "https://dbin.ng/sitemap.xml",
  };
}
