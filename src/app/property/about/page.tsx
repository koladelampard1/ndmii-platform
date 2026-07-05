import { Landmark, LockKeyhole, ShieldCheck } from "lucide-react";
import { PrivacyNotice, PropertyHero, PropertyPublicShell } from "@/components/property/public-property-explorer";

const aboutCards = [
  { icon: Landmark, title: "National trust infrastructure", text: "DBIN provides the digital identity and trust foundation for public property discovery." },
  { icon: ShieldCheck, title: "Registry-grade verification", text: "NPIN and credential records help institutions confirm official property identity status." },
  { icon: LockKeyhole, title: "Privacy by design", text: "Public pages exclude ownership, private documents, personal addresses and internal registry history." },
];

export default function PropertyAboutPage() {
  return (
    <PropertyPublicShell>
      <PropertyHero
        eyebrow="About DLPI"
        title="Digital Land Intelligence Platform for public property trust."
        description="DLPI is the public property intelligence layer of DBIN, designed to make verified registry information discoverable while protecting ownership privacy."
      />
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {aboutCards.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <Icon className="h-7 w-7 text-[#008751]" />
              <h2 className="mt-5 text-xl font-black text-[#06172f]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
            </article>
          ))}
        </div>
        <section className="rounded-[2rem] bg-[#06172f] p-8 text-white">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#D4A017]">Phase 4 scope</p>
          <h2 className="mt-3 text-3xl font-black">Search, discovery and verification — no GIS editing yet.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-200">This phase introduces public explorer pages, NPIN lookup, state explorer summaries and privacy-safe property profiles. GIS boundary drawing, survey editing, conveyancing, marketplace, AI and intelligence dashboards remain outside this phase.</p>
        </section>
        <PrivacyNotice />
      </section>
    </PropertyPublicShell>
  );
}
