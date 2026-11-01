import type { Metadata } from "next";
import { DbinHomepage } from "@/components/public/dbin-homepage";

const title = "DBIN | Trusted business identity and enterprise infrastructure";
const description = "DBIN connects trusted business identity, operating records, enterprise development, market access and institution-led programmes in one reusable platform.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/", siteName: "Digital Business Identity Network", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function LandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Digital Business Identity Network",
    alternateName: "DBIN",
    url: "https://www.dbin.ng",
    description,
  };

  return (
    <div className="min-h-screen bg-[#f5f4eb] text-[#17382e]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <DbinHomepage />
    </div>
  );
}
