import { LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";

export default function LcdboContactPage() {
  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="Contact"
        title="Connect with the LCDBO programme desk."
        description="This contact page is a safe Phase 2 intake surface. CRM routing and partner onboarding workflows should be attached in a later phase."
      />
      <LcdboSection title="Programme enquiry">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
            <input name="name" placeholder="Full name" className="rounded-md border border-slate-200 px-3 py-3 text-sm" />
            <input name="email" type="email" placeholder="Email address" className="rounded-md border border-slate-200 px-3 py-3 text-sm" />
            <input name="organisation" placeholder="Organisation" className="rounded-md border border-slate-200 px-3 py-3 text-sm" />
            <select name="interest" className="rounded-md border border-slate-200 px-3 py-3 text-sm">
              <option>MSME registration</option>
              <option>Partner participation</option>
              <option>Investor opportunity</option>
              <option>State government participation</option>
              <option>Technical support</option>
            </select>
            <textarea name="message" placeholder="Describe your enquiry" className="min-h-32 rounded-md border border-slate-200 px-3 py-3 text-sm md:col-span-2" />
            <button type="button" className="rounded-md bg-[#06172f] px-4 py-3 text-sm font-black text-white md:col-span-2">
              Submit Enquiry
            </button>
          </form>
          <aside className="rounded-2xl bg-[#06172f] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#f2c76b]">Current routing</p>
            <h2 className="mt-2 text-2xl font-black">Phase 2 intake placeholder</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">This page does not create a separate LCDBO account or workflow. Future CRM, partner, and institution onboarding should connect through DBIN programme records and platform events.</p>
          </aside>
        </div>
      </LcdboSection>
    </LcdboShell>
  );
}
