import type { Metadata } from "next";
import { BadgeCheck, Banknote, Building2, Factory, Handshake, Users } from "lucide-react";
import { LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { lcdboInstitutionalAttribution } from "@/lib/lcdbo/public-governance";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export const metadata: Metadata = {
  title: "Contact LCDBO | Programme Enquiries",
  description:
    "Contact the LCDBO programme desk for MSME participation, institutional partnership, investor engagement, technical support and state-level coordination.",
  alternates: {
    canonical: `${LCDBO_CANONICAL_ORIGIN}/contact`,
  },
};

export default function LcdboContactPage() {
  const pathways = [
    { title: "MSME participation", detail: "Business registration, DBIN identity and cluster interest.", icon: Users },
    { title: "State and LGA coordination", detail: "Local product pathways, industrial land and mobilisation.", icon: Building2 },
    { title: "Investment engagement", detail: "Capital deployment, guarantees and structured industrial pipelines.", icon: Banknote },
    { title: "Technical partnership", detail: "Engineering, standards, machinery, skills and infrastructure support.", icon: Factory },
    { title: "Institutional partnership", detail: "Federal, state, development-finance and association coordination.", icon: Handshake },
    { title: "Programme model enquiries", detail: "Authoritative milestones, KPI governance and implementation phases.", icon: BadgeCheck },
  ] as const;

  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="Contact"
        title="Connect with the LCDBO programme desk."
        description="Use this enquiry route for MSME participation, institutional partnership, investor engagement, technical support and state-level coordination."
      />
      <LcdboSection title="Programme enquiry">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">Full name<input name="name" autoComplete="name" className="rounded-md border border-slate-200 px-3 py-3 text-sm font-medium normal-case tracking-normal text-slate-900" /></label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">Email address<input name="email" type="email" autoComplete="email" className="rounded-md border border-slate-200 px-3 py-3 text-sm font-medium normal-case tracking-normal text-slate-900" /></label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">Organisation<input name="organisation" autoComplete="organization" className="rounded-md border border-slate-200 px-3 py-3 text-sm font-medium normal-case tracking-normal text-slate-900" /></label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">Enquiry type<select name="interest" className="rounded-md border border-slate-200 px-3 py-3 text-sm font-medium normal-case tracking-normal text-slate-900">
                <option>MSME registration</option>
                <option>Partner participation</option>
                <option>Investor opportunity</option>
                <option>State government participation</option>
                <option>Technical support</option>
                <option>Programme model and milestones</option>
              </select></label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600 md:col-span-2">Message<textarea name="message" className="min-h-32 rounded-md border border-slate-200 px-3 py-3 text-sm font-medium normal-case tracking-normal text-slate-900" /></label>
            <button type="button" className="rounded-md bg-[#06172f] px-4 py-3 text-sm font-black text-white md:col-span-2">
              Submit Enquiry
            </button>
            <p className="text-xs leading-5 text-slate-500 md:col-span-2">This public form is presented as an enquiry interface. Final submission routing should be connected to the approved LCDBO contact workflow before public launch.</p>
          </form>
          <aside className="rounded-2xl bg-[#06172f] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#f2c76b]">Programme desk</p>
            <h2 className="mt-2 text-2xl font-black">Structured enquiry routing</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Enquiries can be routed by participation pathway while LCDBO registration and programme workspace access continue through DBIN.</p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200">Intended public contact</p>
              <p className="mt-2 text-lg font-black">{lcdboInstitutionalAttribution.publicContactEmail}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{lcdboInstitutionalAttribution.publicContactStatus}</p>
            </div>
          </aside>
        </div>
      </LcdboSection>
      <LcdboSection title="Stakeholder enquiry pathways" description="LCDBO enquiries are organised around the participation routes needed for a national industrial transformation programme.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pathways.map((pathway) => {
            const Icon = pathway.icon;
            return (
              <article key={pathway.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <Icon className="h-6 w-6 text-[#008751]" />
                <h2 className="mt-4 text-lg font-black text-[#06172f]">{pathway.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{pathway.detail}</p>
              </article>
            );
          })}
        </div>
      </LcdboSection>
    </LcdboShell>
  );
}
