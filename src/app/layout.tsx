import "./globals.css";
import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.dbin.ng"),
  title: {
    default: "DBIN | Nigeria’s Digital Business Infrastructure",
    template: "%s | DBIN",
  },
  description:
    "DBIN provides trusted digital business identity, verification, operating tools, compliance readiness, marketplace access and institutional intelligence for Nigerian businesses and partners.",
  applicationName: "Digital Business Identity Network",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "DBIN | Nigeria’s Digital Business Infrastructure",
    description:
      "Trusted digital business identity, verification, operating readiness, marketplace access and institutional intelligence for Nigerian businesses and partners.",
    url: "/",
    siteName: "Digital Business Identity Network",
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DBIN | Nigeria’s Digital Business Infrastructure",
    description:
      "Nigeria’s trusted digital infrastructure for business identity, formalisation, compliance readiness, opportunity and enterprise intelligence.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#064e3b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100">{children}</body>
    </html>
  );
}
