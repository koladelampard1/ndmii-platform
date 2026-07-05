import Link from "next/link";
import { PropertyHero, PropertyPublicShell } from "@/components/property/public-property-explorer";

const faqs = [
  ["What is an NPIN?", "An NPIN is a National Property Identification Number issued after a property record has completed the required registry workflow."],
  ["Does this prove ownership?", "The public explorer confirms registry identity and credential status. It does not publish ownership names or replace formal legal due diligence."],
  ["Why can’t I see owner names?", "DLPI is privacy-safe by design. Ownership names, percentages, personal addresses, private documents and internal registry history are not public."],
  ["What does verified mean?", "Verified means the registry has issued a property identity credential and the public record is currently available for confirmation."],
  ["Can I use QR tokens?", "The token verification model is prepared in this phase. A dedicated QR verification UI is intentionally reserved for a later phase."],
];

export default function PropertyHelpPage() {
  return (
    <PropertyPublicShell>
      <PropertyHero
        eyebrow="DLPI Help Centre"
        title="Clear answers for public property discovery and verification."
        description="Use this guide to understand NPIN lookup, registry statuses, privacy protections and responsible use of public property information."
      />
      <section className="mx-auto max-w-4xl space-y-5 px-4 py-10 sm:px-6">
        <section id="npin" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-[#06172f]">NPIN lookup</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Use the verification page to confirm whether an NPIN or credential token exists and whether it is valid, revoked, superseded, suspended, expired or unknown.</p>
          <Link href="/property/verify" className="mt-5 inline-flex rounded-xl bg-[#06172f] px-4 py-3 text-sm font-black text-white">Verify NPIN</Link>
        </section>

        <section id="statuses" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-[#06172f]">Registry statuses</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {["Approved", "Verified", "Active", "Revoked", "Superseded", "Suspended", "Expired", "Unknown"].map((status) => (
              <div key={status} className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">{status}</div>
            ))}
          </div>
        </section>

        <section id="privacy" className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
          <h2 className="text-2xl font-black">Privacy protections</h2>
          <p className="mt-3 text-sm leading-6">The public explorer never shows owner names, phone numbers, emails, private document URLs, internal comments, assignment data, claims or ownership percentages.</p>
        </section>

        <section className="space-y-3">
          {faqs.map(([question, answer]) => (
            <details key={question} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer font-black text-[#06172f]">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
            </details>
          ))}
        </section>
      </section>
    </PropertyPublicShell>
  );
}
