import type { Metadata } from "next";
import { PublicPageShell } from "@/components/public/public-page-shell";

export const metadata: Metadata = {
  title: "About DBIN",
  description:
    "Learn how DBIN supports trusted Nigerian business identity, verification, readiness workflows and institution-ready enterprise participation.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About DBIN",
    description:
      "DBIN is designed to support trusted business identity, verification, readiness and enterprise participation across Nigeria.",
    url: "/about",
  },
  twitter: {
    card: "summary_large_image",
    title: "About DBIN",
    description: "Trusted business identity and verification infrastructure for Nigerian MSMEs and institutions.",
  },
};

export default function AboutPage() {
  return (
    <PublicPageShell
      eyebrow="About Digital Business Identity Network (DBIN)"
      title="DBIN is Nigeria's Digital Business Identity Network (DBIN) for trusted MSME participation"
      description="Digital Business Identity Network (DBIN) is an independent business identity and verification network for MSMEs, associations, institutions, marketplaces, lenders, and buyers. DBIN helps participants discover trusted businesses, improve compliance readiness, and transact with greater confidence across Nigeria's formal and informal economy."
      primaryCta={{ label: "Register your business", href: "/register/msme" }}
      secondaryCta={{ label: "Verify an MSME", href: "/verify" }}
      highlights={[
        "Business identity credential issuance with automated Business Identity Numbers and QR-backed records.",
        "Cross-role network access for MSMEs, associations, reviewers, FCCPC, FIRS, and administrators.",
        "Adapter-based trust integrations for NIN, BVN, CAC, and TIN verification workflows.",
        "Built-in civic compliance tooling for complaints resolution, tax/VAT simulation, and audit-ready reporting.",
      ]}
    />
  );
}
